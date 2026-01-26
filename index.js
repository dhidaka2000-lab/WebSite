// Firebaseの初期化
import {
  auth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from "./firebase.js";

// ------------------------------
// メールアドレス + パスワード
// ------------------------------
document.getElementById("loginBtn").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, pass)
    .then(() => {
      window.location.href = "mainMenu.html";
    })
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "ログイン失敗：" + error.message;
    });
});

// ------------------------------
// Google ログイン
// ------------------------------
document.getElementById("googleBtn").addEventListener("click", () => {
  const provider = new GoogleAuthProvider();

  signInWithPopup(auth, provider)
    .then(() => {
      window.location.href = "mainMenu.html";
    })
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Google ログイン失敗：" + error.message;
    });
});

// ------------------------------
// Apple ログイン
// ------------------------------
document.getElementById("appleBtn").addEventListener("click", () => {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");

  signInWithPopup(auth, provider)
    .then(() => {
      window.location.href = "mainMenu.html";
    })
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Apple ログイン失敗：" + error.message;
    });
});

// ------------------------------
// Microsoft ログイン
// ------------------------------
document.getElementById("msBtn").addEventListener("click", () => {
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({ prompt: "select_account" });

  signInWithPopup(auth, provider)
    .then(() => {
      window.location.href = "mainMenu.html";
    })
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Microsoft ログイン失敗：" + error.message;
    });
});