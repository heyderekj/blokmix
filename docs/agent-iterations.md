# Bring an implementation back to Blokmix

Open **Draft history → Agent tools → Connect your AI**. Add the displayed URL as a remote MCP connector in your AI client, then sign in. **Send my changes** saves a version and gives you a prompt for that version. Paste it into the client. A local coding agent can also use the existing stdio bridge.

The agent calls `get_handoff` for a file index and reads named files in chunks. The packet contains the existing Astro and Next.js exports, the version snapshot, edits since the previous implementation, editable field names, and the return schema. The hosted connector accepts only handoffs sent by the person who signed in. The existing mix role, archive state and shipping entitlement are checked on each access.

The agent submits a `blokmix.return/v1` bundle using `submit_changes`. The hosted tool takes the handoff ID and the JSON-encoded bundle. The local bridge takes the bundle object. A build can also provide the same JSON as a file. In an existing mix, choose **Draft history → Agent tools → Bring into Blokmix**. From the mixes page, choose **Bring into Blokmix → Copy instructions for my AI** to get the standalone return format. A bundle without a base version starts a new mix.

New layouts can use a built-in clip or declare responsive rows of native fields. Choice and toggle controls bind to word fields and block styles. Range controls bind to a block’s gap. A build can also return a working preview URL for custom runtime behavior.

## Hosted deployment

Run the project’s usual Composer install, frontend build and migrations. Supply Passport’s persistent `PASSPORT_PRIVATE_KEY` and `PASSPORT_PUBLIC_KEY` through the deployment’s secret store. On a local installation, `php artisan passport:keys` creates the pair under storage. Configure the public edge to forward the OAuth and discovery paths listed in `docs/edge-paths.json` to the same Laravel app as `/api/mcp`. OAuth client registration and consent are handled by Laravel MCP and Passport.
