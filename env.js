window.__env = {
  FIREBASE_API_KEY: "AIzaSyA3dHqSdAUJiSwtRFQ6FACQ5tf0qoBPOFU",
  FIREBASE_AUTH_DOMAIN: "mialojamiento.firebaseapp.com",
  FIREBASE_PROJECT_ID: "mialojamiento",
  FIREBASE_STORAGE_BUCKET: "mialojamiento.firebasestorage.app",
  FIREBASE_MESSAGING_SENDER_ID: "49587506461",
  FIREBASE_APP_ID: "1:49587506461:web:dce7f723b0f35fee4c65f4"
};

(function bootstrapMaterial3() {
  if (typeof document === 'undefined') return;

  if (!document.querySelector('link[data-material3]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/material3.css';
    link.dataset.material3 = 'true';
    document.head.appendChild(link);
  }

  if (!document.querySelector('script[data-material3-ui]')) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'js/material3-ui.js';
    script.dataset.material3Ui = 'true';
    document.head.appendChild(script);
  }
})();
