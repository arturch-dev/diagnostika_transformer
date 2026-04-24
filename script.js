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
    const payload = {
        date: new Date().toLocaleString("uk-UA"),
        name: nameInput.value.trim(),
        phone: iti.getNumber(),
        telegram: telegramInput.value.trim(),
        testCode: testCode,
        utm_source: utms.source,
        utm_medium: utms.medium,
        utm_campaign: utms.campaign,
        utm_content: utms.content,
        utm_term: utms.term
    };

    // JSONP Implementation to bypass CORS
    const callbackName = 'wfp_callback_' + Math.round(100000 * Math.random());
    
    // Create the global callback function
    window[callbackName] = function(result) {
        // Cleanup
        delete window[callbackName];
        const scriptElement = document.getElementById(callbackName + '_script');
        if (scriptElement) scriptElement.remove();

        console.log('GAS JSONP Response:', result);

        if (result.status === 'success') {
            console.log('Success! Preparing WayForPay form...');
            if (window.fbq) fbq('track', 'Lead');
            
            // Наповнюємо форму WayForPay
            const wfpForm = document.getElementById('wfpForm');
            wfpForm.querySelector('[name="merchantAccount"]').value = result.merchantAccount;
            wfpForm.querySelector('[name="merchantDomainName"]').value = result.merchantDomainName;
            wfpForm.querySelector('[name="orderReference"]').value = result.orderReference;
            wfpForm.querySelector('[name="orderDate"]').value = result.orderDate;
            wfpForm.querySelector('[name="amount"]').value = result.amount;
            wfpForm.querySelector('[name="currency"]').value = result.currency;
            wfpForm.querySelector('[name="productName[]"]').value = result.productName[0];
            wfpForm.querySelector('[name="productCount[]"]').value = result.productCount[0];
            wfpForm.querySelector('[name="productPrice[]"]').value = result.productPrice[0];
            wfpForm.querySelector('[name="merchantSignature"]').value = result.signature;

            const baseUrl = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
            const urlParams = window.location.search;
            
            wfpForm.querySelector('[name="returnUrl"]').value = baseUrl + '/thanks.html' + urlParams;
            wfpForm.querySelector('[name="declineUrl"]').value = baseUrl + '/failed.html' + urlParams;
            wfpForm.querySelector('[name="serviceUrl"]').value = GOOGLE_SCRIPT_URL;

            console.log('Submitting to WayForPay...');
            wfpForm.submit();
        } else {
            console.error('GAS returned error status:', result);
            alert("Помилка: " + (result.message || "Невідома помилка сервера"));
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            lucide.createIcons();
        }
    };

    // Construct JSONP request URL
    const submissionParams = new URLSearchParams();
    Object.keys(payload).forEach(key => submissionParams.append(key, payload[key]));
    submissionParams.append('callback', callbackName);

    const script = document.createElement('script');
    script.id = callbackName + '_script';
    script.src = GOOGLE_SCRIPT_URL + (GOOGLE_SCRIPT_URL.includes('?') ? '&' : '?') + submissionParams.toString();
    
    script.onerror = function() {
        console.error('JSONP script load failed');
        alert("Сталася помилка при з'єднанні з сервером. Перевірте підключення.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        lucide.createIcons();
    };

    console.log('Sending JSONP request to GAS...');
    document.body.appendChild(script);
});
