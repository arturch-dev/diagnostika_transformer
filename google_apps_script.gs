/**
 * Google Apps Script for Handling Leads and WayForPay Payments
 * 
 * Instructions:
 * 1. Open Google Sheets.
 * 2. Go to Extensions -> Apps Script.
 * 3. Paste this code.
 * 4. IMPORTANT: Run the `setupEnvironment()` function ONCE to set your keys.
 * 5. Deploy as Web App -> Execute as 'Me' -> Access 'Anyone'.
 */

// --- CONFIGURATION ---

// Set your actual keys here and run setupEnvironment() ONCE
function setupEnvironment() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'MERCHANT_ACCOUNT': 'www_instagram_com2361',
    'MERCHANT_SECRET_KEY': 'a82c3621f0f5ca58a8ffefc594c842ac430080d2',
    'MERCHANT_DOMAIN': 'vova-win.com' // Replace with your actual domain
  });
  console.log('Environment variables set successfully!');
}

const CONSTANTS = {
  CURRENCY: 'UAH',
  PRODUCT_NAME: 'Коуч-сесія TRANSFORMER',
  AMOUNT: 1000
};

// --- CORE LOGIC ---

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const props = PropertiesService.getScriptProperties().getProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Target the sheet with ID 0 (gid=0)
  const sheet = ss.getSheets().find(s => s.getSheetId() === 0) || ss.getSheets()[0];
  
  // 1. Check for Redirect Action (Handles returnUrl/declineUrl to avoid 405 or security blocks)
  if (e.parameter.action === 'redirect') {
    const target = e.parameter.target === 'thanks' ? 'thanks.html' : 'failed.html';
    const origin = e.parameter.origin;
    // WayForPay sends status in POST body or GET params
    let status = e.parameter.transactionStatus;
    if (!status && e.postData && e.postData.contents) {
       try {
         const body = JSON.parse(e.postData.contents);
         status = body.transactionStatus;
       } catch(err) {}
    }
    
    const redirectUrl = origin + '/' + target + '?transactionStatus=' + (status || 'Approved');
    
    return HtmlService.createHtmlOutput(
      '<html><head><script>window.top.location.href = "' + redirectUrl + '";</script></head><body style="background:#09090b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">Перенаправлення...</body></html>'
    );
  }

  let data;
  if (e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = e.parameter;
    }
  } else {
    data = e.parameter;
  }

  // Support for JSONP callback
  const callback = e.parameter.callback;

  // CASE 1: New Lead from Website
  if (data.name && data.phone && !data.transactionStatus) {
    const orderReference = data.orderReference || ('ORD-' + new Date().getTime());
    const amount = data.amount || CONSTANTS.AMOUNT;
    
    // Log to Google Sheet
    sheet.appendRow([
      data.date,
      data.name,
      data.phone,
      data.telegram,
      amount,
      'Очікує оплати', // Status
      orderReference,
      data.utm_source,
      data.utm_medium,
      data.utm_campaign,
      data.utm_content,
      data.utm_term
    ]);

    const resultData = {
      status: 'success',
      orderReference: orderReference
    };

    if (callback) {
      const output = callback + '(' + JSON.stringify(resultData) + ')';
      return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(JSON.stringify(resultData)).setMimeType(ContentService.MimeType.TEXT);
  }

  // CASE 2: WayForPay Callback (Server-to-Server)
  if (e.postData && e.postData.contents) {
    const wfpData = JSON.parse(e.postData.contents);
    const orderRef = wfpData.orderReference;
    const status = wfpData.transactionStatus;
    
    const rows = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][6] == orderRef) { // Column G is orderReference
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex !== -1) {
      if (status === 'Approved') {
        sheet.getRange(rowIndex, 6).setValue('Оплачено'); // Column F is status
      } else {
        sheet.getRange(rowIndex, 6).setValue('Відхилено: ' + status);
      }
    }

    // WayForPay Acceptance Response
    const time = Math.floor(new Date().getTime() / 1000);
    const responseSignatureString = [orderRef, 'accept', time].join(';');
    const responseSignature = generateHmacMd5(responseSignatureString, props.MERCHANT_SECRET_KEY);

    const responseBody = {
      orderReference: orderRef,
      status: 'accept',
      time: time,
      signature: responseSignature
    };

    return ContentService.createTextOutput(JSON.stringify(responseBody)).setMimeType(ContentService.MimeType.TEXT);
  }

  const errorData = {status: 'error', message: 'Invalid request'};
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(errorData) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(errorData)).setMimeType(ContentService.MimeType.TEXT);
}

// Helper to generate HMAC-MD5 signature
function generateHmacMd5(message, key) {
  const signature = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_MD5, message, key);
  return signature.map(function(chr) {
    return (chr + 256).toString(16).slice(-2);
  }).join('');
}
