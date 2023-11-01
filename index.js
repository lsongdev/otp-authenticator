import "https://lsong.org/js/application.js";
import { ready } from 'https://lsong.org/scripts/dom.js';
import { copy } from 'https://lsong.org/scripts/clipboard.js';
import { sha1hmac } from 'https://lsong.org/scripts/crypto.js';
import { base32decode } from 'https://lsong.org/scripts/crypto/base32.js';
import { h, render, useState, useEffect, useLocalStorageState, ProgressBar } from 'https://lsong.org/scripts/react/index.js';

async function generateTOTP(secret) {
  const epoch = Math.floor(Date.now() / 1000);
  const time = new Uint8Array(8);
  new DataView(time.buffer).setUint32(4, Math.floor(epoch / 30), false);
  const key = base32decode(secret);
  const hmac = await sha1hmac(key, time);
  const offset = hmac[19] & 0xf;
  const otp = new DataView(hmac.buffer).getUint32(offset) & 0x7fffffff;
  return (otp % 1000000).toString().padStart(6, '0');
}

const SiteItem = ({ site }) => {
  const [otp, setOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);

  const generateOtp = async () => {
    const newOtp = await generateTOTP(site.secret);
    setOtp(newOtp);
  };

  useEffect(() => {
    generateOtp();
    const interval = setInterval(() => {
      const currentTime = Math.floor(Date.now() / 1000);
      const newTimeLeft = 30 - (currentTime % 30);
      setTimeLeft(newTimeLeft);
      if (newTimeLeft === 30) {
        generateOtp();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [site]);
  const cardStyle = {
    marginBottom: '16px',
  };
  const contentStyle = {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  };
  const issuerStyle = {
    fontSize: '18px',
    fontWeight: 'bold',
  };
  const url = new URL(site.otpAuthUrl);
  const username = decodeURIComponent(url.pathname.split('/').pop());
  const progressBarCls = timeLeft > 5 ? 'progress-bar-green' : 'progress-bar-red';
  return h('div', { style: cardStyle, className: 'card' }, [
    h('div', { style: contentStyle, className: 'flex flex-center' }, [
      h('div', null, [
        h('div', { style: issuerStyle }, username),
        h('div', null, site.issuer),
      ]),
      h('div', { className: "otp-code", onClick: () => copy(otp) }, otp),
    ]),
    h(ProgressBar, { value: timeLeft, max: 30, className: progressBarCls }),
  ]);
};

const App = () => {
  const [otpAuthUrl, setOtpAuthUrl] = useState('otpauth://totp/john.doe?secret=N2SJSUOXCKQM5MAX7N7J3NBUQ4WTL66G&issuer=example.org');
  const [sites, setSites] = useLocalStorageState('sites', []);

  const formStyle = {
    display: 'flex',
    marginBottom: '20px',
  };

  const inputStyle = {
    flex: 1,
    padding: '8px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '4px 0 0 4px',
  };

  const buttonStyle = {
    padding: '8px 16px',
    fontSize: '16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '0 4px 4px 0',
    cursor: 'pointer',
  };

  const onSubmit = e => {
    e.preventDefault();
    const url = new URL(otpAuthUrl);
    const params = new URLSearchParams(url.search);
    const issuer = params.get('issuer');
    const secret = params.get('secret');
    if (issuer && secret) {
      setSites([...sites, { issuer, secret, otpAuthUrl }]);
      setOtpAuthUrl('');
    } else {
      console.error('Issuer or secret is missing in the URL');
    }
  };

  return h('div', {}, [
    h('h2', {}, "OTP Authenticator"),
    h('form', { onSubmit, style: formStyle }, [
      h('input', {
        style: inputStyle,
        name: "otpauth",
        value: otpAuthUrl,
        placeholder: "Enter otpauth URL",
        onChange: e => setOtpAuthUrl(e.target.value)
      }),
      h('button', { type: "submit", style: buttonStyle }, "Add")
    ]),
    ...sites.map((site, index) => h(SiteItem, { key: index, site }))
  ]);
};

ready(() => {
  const app = document.getElementById('app');
  render(h(App), app);
});