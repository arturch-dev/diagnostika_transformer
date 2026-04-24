// Initialize Lucide icons
lucide.createIcons();

// Settings
const GOOGLE_SCRIPT_URL = APP_CONFIG.API_ENDPOINT;

// Modal Logic
const modal = document.getElementById('leadModal');
const modalContent = document.getElementById('modalContent');

function openModal() {
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
    if (window.fbq) fbq('track', 'InitiateCheckout');
}

// Secret Test Mode Logic
let isTestMode = false;
let testCode = '';
const heroBadge = document.querySelector('.inline-flex.items-center.gap-2');
if (heroBadge) {
    heroBadge.style.cursor = 'pointer';
    heroBadge.addEventListener('dblclick', () => {
        const pass = prompt("Секретний режим. Введіть пароль:");
        if (pass === "557913") {
            isTestMode = true;
            testCode = pass;
            alert("Тестовий режим активовано (1 грн)!");
            heroBadge.classList.add('border-green-500');
            heroBadge.style.borderColor = '#22c55e';
        }
    });
}

function closeModal() {
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

// Phone Input & Validation setup
const phoneInputField = document.querySelector("#phone");
const iti = window.intlTelInput(phoneInputField, {
    initialCountry: "auto",
    excludeCountries: ["ru", "by"],
    geoIpLookup: function (callback) {
        fetch("https://get.geojs.io/v1/ip/country.json")
            .then(resp => resp.json())
            .then(data => callback(data.country))
            .catch(() => callback("ua"));
    },
    utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/18.2.1/js/utils.js",
});

// Timer
function startTimer(duration, display) {
    let timer = duration, minutes, seconds;
    const interval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        display.textContent = minutes + ":" + seconds;
        if (--timer < 0) {
            timer = 0;
            clearInterval(interval);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    const display = document.querySelector('#hero-timer');
    if (display) {
        startTimer(10 * 60, display);
    }
});

function getUTMs() {
    const params = new URLSearchParams(window.location.search);
    return {
        source: params.get('utm_source') || '',
        medium: params.get('utm_medium') || '',
        campaign: params.get('utm_campaign') || '',
        content: params.get('utm_content') || '',
        term: params.get('utm_term') || ''
    };
}

// Form Submission
document.getElementById('leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('name');
    const telegramInput = document.getElementById('telegram');
    const phoneError = document.getElementById('phoneError');
    const nameError = document.getElementById('nameError');
    const submitBtn = document.getElementById('submitBtn');

    phoneError.classList.add('hidden');
    nameError.classList.add('hidden');
    phoneInputField.classList.remove('border-red-500');
    nameInput.classList.remove('border-red-500');

    if (/\d/.test(nameInput.value)) {
        nameError.classList.remove('hidden');
        nameInput.classList.add('border-red-500');
        return;
    }

    if (!iti.isValidNumber()) {
        phoneError.classList.remove('hidden');
        phoneInputField.classList.add('border-red-500');
        return;
    }

    submitBtn.disabled = true;
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Завантаження...';
    lucide.createIcons();

    const utms = getUTMs();
    
    // 1. Prepare Order Data
    const orderReference = 'ORD-' + Date.now();
    const orderDate = Math.floor(Date.now() / 1000);
    let amount = 1000;
    let productName = 'Коуч-сесія TRANSFORMER';
    
    if (isTestMode && testCode === '557913') {
        amount = 1;
        productName = '[TEST] ' + productName;
    }

    const payload = {
        date: new Date().toLocaleString("uk-UA"),
        name: nameInput.value.trim(),
        phone: iti.getNumber(),
        telegram: telegramInput.value.trim(),
        testCode: testCode,
        amount: amount,
        orderReference: orderReference,
        utm_source: utms.source,
        utm_medium: utms.medium,
        utm_campaign: utms.campaign,
        utm_content: utms.content,
        utm_term: utms.term
    };

    // 2. Generate WayForPay Signature (Client-Side for 100% reliability)
    const merchantAccount = APP_CONFIG.WFP_MERCHANT_ACCOUNT;
    const merchantDomainName = APP_CONFIG.WFP_MERCHANT_DOMAIN;
    const merchantSecretKey = APP_CONFIG.WFP_MERCHANT_SECRET_KEY;
    const currency = 'UAH';
    const productCount = 1;
    const productPrice = amount;

    // String format: merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName;productCount;productPrice
    const signatureString = [
        merchantAccount,
        merchantDomainName,
        orderReference,
        orderDate,
        amount,
        currency,
        productName,
        productCount,
        productPrice
    ].join(';');
    
    const signature = CryptoJS.HmacMD5(signatureString, merchantSecretKey).toString();

    // 3. Send Lead to Google Sheets (Non-blocking, ignore CORS errors)
    try {
        const params = new URLSearchParams();
        Object.keys(payload).forEach(key => params.append(key, payload[key]));
        
        // Use no-cors to avoid AdBlock/CORS blocking the whole script
        fetch(APP_CONFIG.API_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            body: params
        }).catch(err => console.log('GAS fetch error (ignored):', err));
    } catch (e) {
        console.log('GAS submission error (ignored)', e);
    }

    // 4. Submit to WayForPay Form Directly
    const wfpForm = document.getElementById('wfpForm');
    wfpForm.querySelector('[name="merchantAccount"]').value = merchantAccount;
    wfpForm.querySelector('[name="merchantDomainName"]').value = merchantDomainName;
    wfpForm.querySelector('[name="orderReference"]').value = orderReference;
    wfpForm.querySelector('[name="orderDate"]').value = orderDate;
    wfpForm.querySelector('[name="amount"]').value = amount;
    wfpForm.querySelector('[name="currency"]').value = currency;
    wfpForm.querySelector('[name="productName[]"]').value = productName;
    wfpForm.querySelector('[name="productCount[]"]').value = productCount;
    wfpForm.querySelector('[name="productPrice[]"]').value = productPrice;
    wfpForm.querySelector('[name="merchantSignature"]').value = signature;

    // Use current URL origin and path as base, but ensure it works on Vercel/LiveServer
    let baseUrl = window.location.origin + window.location.pathname;
    if (baseUrl.endsWith('.html')) {
        baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
    } else if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }

    const urlParams = window.location.search;
    
    wfpForm.querySelector('[name="returnUrl"]').value = baseUrl + '/thanks.html' + urlParams;
    wfpForm.querySelector('[name="declineUrl"]').value = baseUrl + '/failed.html' + urlParams;
    wfpForm.querySelector('[name="serviceUrl"]').value = APP_CONFIG.API_ENDPOINT;

    if (window.fbq) fbq('track', 'Lead');
    
    console.log('Redirecting to WayForPay...');
    wfpForm.submit();
});
