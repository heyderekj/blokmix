/** Whether Laravel served this page (an Inertia app), rather than Vite on its own. Set by resources/views/app.blade.php. */
export const isHosted = () => typeof document !== 'undefined' && document.querySelector('meta[name="blokmix-host"]')?.getAttribute('content') === 'laravel'
