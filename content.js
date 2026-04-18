// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    // Collect text from the body, filtering out scripts and styles
    const bodyText = document.body.innerText;
    const title = document.title;
    const url = window.location.href;
    
    sendResponse({ 
      content: bodyText, 
      title: title,
      url: url
    });
  }
  return true; // Keep the message channel open for async response
});
