export default function manifest() {
    return {
        name: 'The Himalayan Horizon',
        short_name: 'Himalayan Horizon',
        description: 'Discover the Himalayas Beyond the Ordinary. Villages, homestays, trip planner and shared cabs in Uttarakhand.',
        id: '/',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f4ee',
        theme_color: '#1f4d3a',
        lang: 'hi',
        categories: ['travel', 'lifestyle'],
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
            { name: 'Plan a trip', url: '/plan' },
            { name: 'Instant cab', url: '/cab' },
            { name: 'Villages', url: '/villages' },
        ],
    };
}
