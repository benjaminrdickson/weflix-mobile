import * as WebBrowser from 'expo-web-browser';

export function openTrailer(videoKey) {
  if (!videoKey) return;
  WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${videoKey}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
    toolbarColor: '#1a0505',
  });
}
