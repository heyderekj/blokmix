<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;
use App\Services\AgentIterations;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class AgentIterationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_hosted_agent_can_authorize_and_return_work_while_the_board_is_closed(): void
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048]);
        openssl_pkey_export($key, $private);
        config(['passport.private_key' => $private, 'passport.public_key' => openssl_pkey_get_details($key)['key'], 'blokmix.waitlist_mode' => true]);
        $owner = User::factory()->create();
        $mix = Mix::create(['name' => 'Two rounds']);
        $mix->admit($owner, MixRole::Owner);
        $mix->versions()->create(['key' => 'v1', 'letter' => 'A1', 'node' => ['kind' => 'snapshot', 'draftId' => 'draft_a']]);
        $id = $this->actingAs($owner)->postJson("/api/mixes/$mix->id/handoffs", ['version' => 'v1', 'packet' => '{"base":"v1","files":{"notes.txt":"Sample file"}}'])->assertCreated()->json('id');
        $callback = 'https://example.test/agent/callback';
        $client = $this->postJson('/oauth/register', ['client_name' => 'Test agent', 'redirect_uris' => [$callback]])->assertCreated()->json('client_id');
        $verifier = Str::random(64);
        $this->get('/oauth/authorize?'.http_build_query([
            'response_type' => 'code', 'state' => 'state', 'client_id' => $client, 'redirect_uri' => $callback, 'scope' => 'mcp:use',
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='), 'code_challenge_method' => 'S256',
        ]))->assertOk()->assertSee('Test agent');
        $redirect = $this->post('/oauth/authorize', ['auth_token' => session('authToken'), 'client_id' => $client, 'state' => 'state'])->assertRedirect()->headers->get('Location');
        parse_str(parse_url($redirect, PHP_URL_QUERY), $params);
        $token = $this->post('/oauth/token', ['grant_type' => 'authorization_code', 'client_id' => $client, 'code_verifier' => $verifier, 'redirect_uri' => $callback, 'code' => $params['code']])->assertOk()->json('access_token');
        $headers = ['Authorization' => 'Bearer '.$token, 'MCP-Protocol-Version' => '2025-11-25'];
        $call = fn ($name, $args) => $this->postJson('/api/mcp', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/call', 'params' => ['name' => $name, 'arguments' => $args]], $headers)->assertOk();
        $call('get_handoff', ['handoff' => $id])->assertJsonPath('result.content.0.text', '{"base":"v1","files":["notes.txt"]}');
        $part = $call('get_handoff', ['handoff' => $id, 'file' => 'notes.txt', 'offset' => 7])->json('result.content.0.text');
        $this->assertSame(['encoding' => 'text', 'content' => 'file', 'nextOffset' => null], json_decode($part, true));
        $bundle = ['format' => 'blokmix.return/v1', 'base' => 'v1', 'id' => (string) Str::uuid(), 'agent' => 'AI', 'summary' => 'Built pricing', 'changes' => [[
            'kind' => 'add', 'page' => '/', 'section' => 'plans', 'recipe' => ['title' => 'Plans', 'type' => 'pricing', 'layout' => ['clip' => 'pricing.layout-columns'],
                'controls' => [['kind' => 'toggle', 'label' => 'Highlight plans', 'options' => [['label' => 'Off', 'words' => (object) [], 'surface' => 'page'], ['label' => 'On', 'words' => (object) [], 'surface' => 'brand']]]]],
        ]]];
        $call('submit_changes', ['handoff' => $id, 'bundle' => json_encode($bundle)])->assertJsonPath('result.content.0.text', 'Submitted to the originating draft for review.');
        $this->actingAs($owner, 'web')->getJson("/api/mixes/$mix->id/returns")->assertJsonPath('items.0.summary', 'Built pricing');
    }

    public function test_handoff_returns_are_scoped_and_retryable_and_sharing_requires_curation(): void
    {
        config(['blokmix.waitlist_mode' => true]);
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $mix = Mix::create(['name' => 'Pricing']);
        $mix->admit($owner, MixRole::Owner);
        $mix->versions()->create(['key' => 'v1', 'letter' => 'A1', 'node' => ['kind' => 'snapshot', 'draftId' => 'draft_a']]);
        $id = $this->actingAs($owner)->postJson("/api/mixes/$mix->id/handoffs", ['version' => 'v1', 'packet' => '{"base":"v1"}'])->assertCreated()->json('id');
        $service = app(AgentIterations::class);
        $handoff = $service->handoff($owner, $id);
        $bundle = ['format' => 'blokmix.return/v1', 'id' => (string) Str::uuid(), 'base' => 'v1', 'summary' => 'Added prices', 'agent' => 'Studio', 'changes' => []];
        $service->submit($handoff, (object) $bundle);
        $service->submit($handoff, (object) $bundle);
        $this->getJson("/api/mixes/$mix->id/returns")->assertOk()->assertJsonCount(1, 'items')->assertJsonPath('items.0.base', 'v1');
        $recipe = ['title' => 'Plans', 'type' => 'pricing', 'layout' => ['clip' => 'pricing.layout-columns'], 'controls' => []];
        $suggestion = $this->postJson("/api/mixes/$mix->id/layout-suggestions", compact('recipe'))->assertCreated()->json('id');
        $this->actingAs($other)->getJson("/api/mixes/$mix->id/returns")->assertForbidden();
        $this->getJson('/api/layout-suggestions')->assertOk()->assertJsonCount(0);
        $this->patchJson("/api/layout-suggestions/$suggestion", ['status' => 'approved'])->assertForbidden();
        config(['blokmix.owners' => [$owner->email]]);
        $this->actingAs($owner)->patchJson("/api/layout-suggestions/$suggestion", ['status' => 'approved'])->assertOk();
        $this->actingAs($other)->getJson('/api/layout-suggestions')->assertJsonPath('0.recipe.title', 'Plans');
        $this->expectException(NotFoundHttpException::class);
        $service->handoff($other, $id);
    }
}
