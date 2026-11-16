<style>
    @font-face {
        font-family: 'Blokmix Preview Figtree';
        src: url('/fonts/figtree-latin-400.woff2') format('woff2');
        font-weight: 400;
        font-display: swap;
    }

    @font-face {
        font-family: 'Blokmix Preview Figtree';
        src: url('/fonts/figtree-latin-600.woff2') format('woff2');
        font-weight: 600;
        font-display: swap;
    }

    [data-blokmix-preview] {
        position: fixed;
        z-index: 2147483647;
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        box-sizing: border-box;
        width: min(14.5rem, calc(100vw - 36px));
        max-height: calc(100dvh - 24px);
        overflow: auto;
        border: 1px solid #eadce5;
        border-radius: 16px;
        background: #fff8fc;
        color: #241824;
        color-scheme: light;
        box-shadow: 0 4px 10px #2c14251a, 0 12px 32px #2c142526;
        font: 400 13px/1.45 'Blokmix Preview Figtree', sans-serif;
        text-align: left;
    }

    [data-blokmix-preview] > summary {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 48px;
        padding: 10px 16px;
        color: inherit;
        font-weight: 600;
        list-style: none;
        cursor: pointer;
    }

    [data-blokmix-preview] > summary::-webkit-details-marker { display: none; }
    [data-blokmix-preview] > summary:focus-visible { outline: 2px solid #ad285f; outline-offset: -4px; border-radius: inherit; }

    [data-blokmix-preview] > summary span { white-space: nowrap; }

    [data-blokmix-preview] > summary img {
        display: inline-block;
        width: 87px;
        height: 14px;
        vertical-align: baseline;
        transform: translateY(2px);
    }

    [data-blokmix-preview] > summary::after {
        content: '';
        width: 7px;
        height: 7px;
        flex: none;
        margin: 0 2px 0 auto;
        border-right: 1.5px solid;
        border-bottom: 1.5px solid;
        transform: translateY(-2px) rotate(45deg);
    }

    [data-blokmix-preview][open] > summary::after { transform: translateY(2px) rotate(225deg); }

    [data-blokmix-preview] > div { display: flow-root; padding-inline: 16px; }

    [data-blokmix-preview] ul {
        display: grid;
        gap: 7px;
        margin: 2px 0 0;
        padding: 0;
        color: #5d4c59;
        list-style: none;
    }

    [data-blokmix-preview] li {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* The pink block button used on Blokmix's sign-up page. */
    [data-blokmix-preview] > div > a {
        display: grid;
        min-height: 36px;
        place-items: center;
        margin: 14px 0 18px;
        padding: 6px 12px;
        border-radius: 999px;
        background: #ff5cb0;
        color: #fff;
        box-shadow: inset 0 2px 0 #ff8cc6, 0 3px 0 #c2185b, 3px 7px 12px -4px rgb(23 18 26 / 0.35);
        font-weight: 600;
        text-align: center;
        text-decoration: none;
        text-shadow: 0 1px 0 rgb(194 24 91 / 0.35);
    }

    [data-blokmix-preview] > div > a:focus-visible { outline: 2px solid #ad285f; outline-offset: 3px; }

    @media (hover: hover) and (pointer: fine) {
        [data-blokmix-preview] > div > a:hover {
            background: #ff69b4;
            box-shadow: inset 0 2px 0 #ff9acd, 0 5px 0 #c2185b, 5px 11px 16px -4px rgb(23 18 26 / 0.32);
        }
    }

    [data-blokmix-preview] > div > a:active {
        box-shadow: inset 0 2px 0 #ff8cc6, 0 0 0 #c2185b, 1px 2px 4px -2px rgb(23 18 26 / 0.3);
    }

    [data-blokmix-preview] li svg {
        width: 15px;
        height: 15px;
        flex: none;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    @media (prefers-reduced-motion: no-preference) {
        [data-blokmix-preview] > div > a {
            transition: translate 240ms cubic-bezier(0.3, 1.4, 0.5, 1), box-shadow 240ms cubic-bezier(0.3, 1.4, 0.5, 1), background-color 150ms;
        }

        @media (hover: hover) and (pointer: fine) {
            [data-blokmix-preview] > div > a:hover { translate: 0 -2px; }
        }

        [data-blokmix-preview] > div > a:active { translate: 0 3px; transition-duration: 90ms; }
        [data-blokmix-preview] > summary::after { transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1); }

        @supports selector(details::details-content) and (transition-behavior: allow-discrete) {
            [data-blokmix-preview]::details-content {
                display: grid;
                grid-template-rows: 0fr;
                opacity: 0;
                transition: grid-template-rows 220ms cubic-bezier(0.23, 1, 0.32, 1),
                    opacity 180ms ease, content-visibility 220ms allow-discrete;
            }

            [data-blokmix-preview][open]::details-content { grid-template-rows: 1fr; opacity: 1; }
            [data-blokmix-preview] > div { min-height: 0; overflow: hidden; }
        }
    }
</style>
<details data-blokmix-preview open>
    <summary><span>Made with <img src="/wordmark-ink.svg" width="87" height="14" alt="Blokmix"></span></summary>
    <div>
        <ul role="list">
            <li>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8" /></svg>
                Anyone with the link can view
            </li>
            <li>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49M14.084 14.158a3 3 0 0 1-4.242-4.242M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143M2 2l20 20" /></svg>
                Search indexing disabled
            </li>
            <li>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5M14.5 12.5l-5 5m0-5 5 5" /></svg>
                Form submissions disabled
            </li>
        </ul>
        <a href="{{ config('blokmix.home_url') }}/register">Create your own</a>
    </div>
</details>
