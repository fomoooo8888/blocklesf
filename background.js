// Ouvre la page de contrôle dans un onglet quand on clique sur l'icône.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
});
