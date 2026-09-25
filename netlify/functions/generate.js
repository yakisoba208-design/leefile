const nacl = require('tweetnacl');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const keyPair = nacl.box.keyPair();
    const privateKey = Buffer.from(keyPair.secretKey).toString('base64');
    const publicKey = Buffer.from(keyPair.publicKey).toString('base64');

    const response = await fetch('https://api.cloudflareclient.com/v0a884/reg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'okhttp/3.12.1'
      },
      body: JSON.stringify({
        key: publicKey,
        install_id: '',
        fcm_token: '',
        tos: new Date().toISOString(),
        model: 'Android',
        serial_number: '',
        locale: 'en_US'
      })
    });

    if (!response.ok) throw new Error('Cloudflare API rejected the registration');
    
    const data = await response.json();
    const v4 = data.config.interface.addresses.v4;
    const v6 = data.config.interface.addresses.v6;
    const peerPubKey = data.config.peers[0].public_key;

    // Advanced Clean IP & Port Randomizer for DPI Bypass
    const cleanIPs = [
      '162.159.192.1', '162.159.193.5', '162.159.195.10', 
      '188.114.97.6', '188.114.96.2', '8.6.112.202', '8.6.112.121'
    ];
    const cleanPorts = [500, 854, 878, 894, 908, 1074, 1701, 2408, 3138, 4198, 7103, 7281, 8854];
    
    const randomIP = cleanIPs[Math.floor(Math.random() * cleanIPs.length)];
    const randomPort = cleanPorts[Math.floor(Math.random() * cleanPorts.length)];
    const cleanEndpoint = `${randomIP}:${randomPort}`;

    const configString = `
# ==========================================
# Vortex Digital Myanmar
# Supported: AmneziaWG (WARP Bypass)
# ==========================================
[Interface]
PrivateKey = ${privateKey}
Address = ${v4}/32, ${v6}/128
DNS = 1.1.1.1, 1.0.0.1
MTU = 1280
Jc = 4
Jmin = 40
Jmax = 70

[Peer]
PublicKey = ${peerPubKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${cleanEndpoint}
`.trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: configString })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};
