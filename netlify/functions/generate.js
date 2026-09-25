const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const tmpDir = os.tmpdir();
    const wgcfPath = path.join(tmpDir, 'wgcf');
    const wgcfConfig = path.join(tmpDir, 'wgcf-account.toml');
    const wgcfProfile = path.join(tmpDir, 'wgcf-profile.conf');

    // 1. Fetch the official WGCF Linux binary if it doesn't exist
    if (!fs.existsSync(wgcfPath)) {
      execSync(`curl -sSL https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_linux_amd64 -o ${wgcfPath}`);
      fs.chmodSync(wgcfPath, '755');
    }

    // 2. Clean up any leftover profiles from previous serverless executions
    if (fs.existsSync(wgcfConfig)) fs.unlinkSync(wgcfConfig);
    if (fs.existsSync(wgcfProfile)) fs.unlinkSync(wgcfProfile);

    // 3. Replicate vpn.bat logic: Register Identity
    execSync(`${wgcfPath} register --accept-tos`, { cwd: tmpDir });

    // 4. Replicate vpn.bat logic: Generate Profile
    execSync(`${wgcfPath} generate`, { cwd: tmpDir });

    // 5. Read the generated profile
    let rawConfig = fs.readFileSync(wgcfProfile, 'utf8');

    // 6. Inject the Myanmar DPI Bypass parameters
    let modifiedConfig = rawConfig.replace(/Endpoint\s*=\s*.*/i, 'Endpoint = 162.159.195.1:500');
    
    // Add MTU 1280 and Keepalive for cellular stability
    if (!modifiedConfig.includes('MTU')) {
        modifiedConfig = modifiedConfig.replace('[Interface]', '[Interface]\nMTU = 1280');
    }
    if (!modifiedConfig.includes('PersistentKeepalive')) {
        modifiedConfig = modifiedConfig.replace('[Peer]', '[Peer]\nPersistentKeepalive = 20');
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: modifiedConfig.trim() })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || 'Failed to execute native WGCF binary' })
    };
  }
};
