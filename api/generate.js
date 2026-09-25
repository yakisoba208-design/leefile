const nacl = require('tweetnacl');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const secretKey = nacl.randomBytes(32);
    secretKey[0] &= 248;
    secretKey[31] &= 127;
    secretKey[31] |= 64;
    
    const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
    const privateKey = Buffer.from(keyPair.secretKey).toString('base64');
    const publicKey = Buffer.from(keyPair.publicKey).toString('base64');

    const cfHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'okhttp/3.12.1',
      'CF-Client-Version': 'a-6.11-2223'
    };

    const regResponse = await fetch('https://api.cloudflareclient.com/v0a884/reg', {
      method: 'POST',
      headers: cfHeaders,
      body: JSON.stringify({
        key: publicKey,
        install_id: '',
        fcm_token: '',
        tos: new Date().toISOString(),
        type: 'Android',
        locale: 'en_US'
      })
    });

    if (!regResponse.ok) throw new Error('Cloudflare API rejected registration');
    
    const regData = await regResponse.json();
    const accountData = regData.result || regData;
    const accountId = accountData.id;
    const accountToken = accountData.token;

    const patchResponse = await fetch(`https://api.cloudflareclient.com/v0a884/reg/${accountId}`, {
      method: 'PATCH',
      headers: {
        ...cfHeaders,
        'Authorization': `Bearer ${accountToken}`
      },
      body: JSON.stringify({ warp_enabled: true })
    });

    if (!patchResponse.ok) throw new Error('Cloudflare API failed to enable WARP');
    
    const patchData = await patchResponse.json();
    const finalData = patchData.result || patchData;

    const v4 = finalData.config.interface.addresses.v4;
    const v6 = finalData.config.interface.addresses.v6;
    const peerPubKey = finalData.config.peers[0].public_key;

    const configString = `
# ==========================================
# Vortex Digital Myanmar
# Supported: WireGuard & AmneziaWG
# ==========================================
[Interface]
PrivateKey = ${privateKey}
Address = ${v4}/32, ${v6}/128
DNS = 1.1.1.1, 1.0.0.1
MTU = 1280

[Peer]
PublicKey = ${peerPubKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = engage.cloudflareclient.com:2408
PersistentKeepalive = 25
`.trim();

    res.status(200).json({ config: configString });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
