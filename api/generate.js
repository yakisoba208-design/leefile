const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const tmpDir = os.tmpdir();
    const wgcfPath = path.join(tmpDir, 'wgcf');
    const wgcfConfig = path.join(tmpDir, 'wgcf-account.toml');
    const wgcfProfile = path.join(tmpDir, 'wgcf-profile.conf');

    // 1. Fetch the correct architecture WGCF binary
    if (!fs.existsSync(wgcfPath)) {
      const arch = os.arch() === 'arm64' ? 'linux_arm64' : 'linux_amd64';
      execSync(`curl -sSL https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_${arch} -o ${wgcfPath}`);
      fs.chmodSync(wgcfPath, '755');
    }

    // 2. Clear previous session data to ensure a fresh keypair
    if (fs.existsSync(wgcfConfig)) fs.unlinkSync(wgcfConfig);
    if (fs.existsSync(wgcfProfile)) fs.unlinkSync(wgcfProfile);

    // 3. Register identity and generate profile exactly like vpn.bat
    execSync(`${wgcfPath} register --accept-tos`, { cwd: tmpDir, stdio: 'ignore' });
    execSync(`${wgcfPath} generate`, { cwd: tmpDir, stdio: 'ignore' });

    // 4. Read the raw WGCF profile
    const rawConfig = fs.readFileSync(wgcfProfile, 'utf8');

    // 5. Apply the exact Regex endpoint replacement used in vpn.bat
    const modifiedConfig = rawConfig.replace(/(?i)Endpoint\s*=\s*.*/, 'Endpoint = 162.159.192.1:500');

    // 6. Prepend the exact Brand Header from vpn.bat
    const brandHeader = `
# ==========================================
# Vortex Digital Myanmar
# Supported: WireGuard & AmneziaWG
# ==========================================
`.trimStart();

    const finalVpnConfig = brandHeader + modifiedConfig;

    res.status(200).json({ config: finalVpnConfig });
  } catch (error) {
    res.status(500).json({ error: error.message || 'WGCF execution failed' });
  }
};
