<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SharingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Mix $mix;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->owner = User::factory()->create(['name' => 'Ada Owner']);
        $this->mix = Mix::create(['name' => 'Launch', 'data' => ['site' => ['pages' => ['home']], 'notes' => []]]);
        $this->mix->admit($this->owner, MixRole::Owner);
    }

    private function link(string $role): string
    {
        return $this->actingAs($this->owner)->postJson("/api/mixes/{$this->mix->id}/share/links", ['role' => $role])->assertCreated()->json('url');
    }

    public function test_signing_up_and_in(): void
    {
        $this->get('/login')->assertInertia(fn (Assert $page) => $page->component('auth/login'));
        $this->get('/register')->assertInertia(fn (Assert $page) => $page->component('auth/register'));
        $this->post('/register', ['name' => 'Grace', 'email' => 'grace@example.test', 'password' => 'a-long-password-1', 'password_confirmation' => 'a-long-password-1'])
            ->assertRedirect('/');
        $this->assertAuthenticated();
        $this->get('/')->assertInertia(fn (Assert $page) => $page->where('auth.user.name', 'Grace'));
    }

    public function test_a_share_link_brings_a_new_person_in_through_sign_up(): void
    {
        $url = $this->link('editor');
        auth()->logout();

        $this->get($url)->assertRedirect('/register');
        $this->post('/register', ['name' => 'Grace', 'email' => 'grace@example.test', 'password' => 'a-long-password-1', 'password_confirmation' => 'a-long-password-1'])
            ->assertRedirect($url);
        $this->get($url)->assertRedirect("/mixes/{$this->mix->id}");

        $grace = User::where('email', 'grace@example.test')->sole();
        $this->assertSame(MixRole::Editor, $this->mix->roleOf($grace));
        $this->get('/')->assertInertia(fn (Assert $page) => $page->where('mixes.0.role', 'editor'));
    }

    public function test_a_link_never_lowers_a_role_and_stops_working_when_revoked(): void
    {
        $editor = User::factory()->create();
        $this->mix->admit($editor, MixRole::Editor);
        $viewLink = $this->link('viewer');

        $this->actingAs($editor)->get($viewLink);
        $this->assertSame(MixRole::Editor, $this->mix->roleOf($editor));

        $id = $this->actingAs($this->owner)->getJson("/api/mixes/{$this->mix->id}/share")->json('links.0.id');
        $this->deleteJson("/api/mixes/{$this->mix->id}/share/links/{$id}")->assertNoContent();
        $stranger = User::factory()->create();
        $this->actingAs($stranger)->get($viewLink)->assertRedirect('/');
        $this->assertNull($this->mix->roleOf($stranger));
    }

    public function test_viewers_only_leave_marks(): void
    {
        $viewer = User::factory()->create();
        $this->mix->admit($viewer, MixRole::Viewer);
        $this->actingAs($viewer)->get("/mixes/{$this->mix->id}")->assertInertia(fn (Assert $page) => $page->where('role', 'viewer'));

        $this->putJson("/api/mixes/{$this->mix->id}", [
            'name' => 'Renamed by a viewer',
            'data' => ['site' => ['pages' => []], 'notes' => [['id' => 'n1', 'text' => 'Love this']]],
            'versions' => ['put' => ['v_X' => ['letter' => 'X']], 'remove' => []],
        ], ['If-Match' => '"1"'])->assertOk();

        $mix = $this->mix->refresh()->load('versions');
        $this->assertSame('Launch', $mix->name);
        $this->assertSame(['home'], $mix->data['site']['pages']);
        $this->assertSame('Love this', $mix->data['notes'][0]['text']);
        $this->assertCount(0, $mix->versions);
        $this->deleteJson("/api/mixes/{$this->mix->id}")->assertForbidden();
    }

    public function test_only_the_owner_shares_changes_roles_and_removes_people(): void
    {
        $editor = User::factory()->create();
        $this->mix->admit($editor, MixRole::Editor);

        $this->actingAs($editor)->getJson("/api/mixes/{$this->mix->id}/share")->assertOk()->assertJsonPath('can_share', false)->assertJsonPath('links', []);
        $this->postJson("/api/mixes/{$this->mix->id}/share/links", ['role' => 'editor'])->assertForbidden();
        $this->deleteJson("/api/mixes/{$this->mix->id}/share/members/{$this->owner->id}")->assertForbidden();

        $this->actingAs($this->owner)->patchJson("/api/mixes/{$this->mix->id}/share/members/{$editor->id}", ['role' => 'viewer'])->assertOk();
        $this->assertSame(MixRole::Viewer, $this->mix->roleOf($editor));
        $this->postJson("/api/mixes/{$this->mix->id}/share/links", ['role' => 'owner'])->assertUnprocessable();
        $this->deleteJson("/api/mixes/{$this->mix->id}/share/members/{$this->owner->id}")->assertStatus(422);
        $this->deleteJson("/api/mixes/{$this->mix->id}/share/members/{$editor->id}")->assertNoContent();
        $this->actingAs($editor)->get("/mixes/{$this->mix->id}")->assertNotFound();
    }

    public function test_a_share_link_says_which_mix_on_sign_up(): void
    {
        $url = $this->link('viewer');
        auth()->logout();
        $this->get($url);
        $this->get('/register')->assertInertia(fn (Assert $page) => $page->where('invite.mix', 'Launch')->where('invite.role', 'viewer'));
    }

    public function test_forgotten_passwords_reset_by_email(): void
    {
        Notification::fake();
        auth()->logout();
        $this->get('/login')->assertInertia(fn (Assert $page) => $page->where('canReset', false));
        config(['mail.default' => 'resend']);
        $this->get('/login')->assertInertia(fn (Assert $page) => $page->where('canReset', true));

        $this->post('/forgot-password', ['email' => $this->owner->email])->assertSessionHas('status');
        $token = null;
        Notification::assertSentTo($this->owner, ResetPassword::class, function (ResetPassword $n) use (&$token) {
            $token = $n->token;

            return true;
        });
        $this->get("/reset-password/{$token}?email=".urlencode($this->owner->email))->assertInertia(fn (Assert $page) => $page->component('auth/reset-password')->where('token', $token));
        $this->post('/reset-password', ['token' => $token, 'email' => $this->owner->email, 'password' => 'a-brand-new-pass-1', 'password_confirmation' => 'a-brand-new-pass-1'])->assertRedirect();
        $this->assertTrue(Hash::check('a-brand-new-pass-1', $this->owner->refresh()->password));
    }
}
