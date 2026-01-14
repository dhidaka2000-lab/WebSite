// firebaseをCDNから読み込む
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ==== 認証：firebase authの初期化
// firebaseコンソールから取得して貼り付け
// https://console.firebase.google.com/project/ekuikidev/settings/general/web:MGMxYWZiYjktOGYzNy00ZGEwLThhNjItNjY2YTIxYzdlNzhl?hl=ja&nonce=1768343931813
// チュートリアル（公式）
// https://www.youtube.com/watch?v=-OKrloDzGpU
// 参考ページ（qiita)
// https://qiita.com/ganyariya/items/7b58c9ba103bacadc380

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBCib4rAXfXO_6nAiEO-VutN-FytgdnuvA",
    authDomain: "ekuikidev.firebaseapp.com",
    projectId: "ekuikidev",
    storageBucket: "ekuikidev.firebasestorage.app",
    messagingSenderId: "896828437660",
    appId: "1:896828437660:web:3c3154fd640a522e0fe959"
};

// Firebaseの初期化
const  app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const   db = firebase.firestore();

// イベントリスナー（ログインフォームからの送信ボタン押下待ち）
document.getElementById("loginBtn").addEventListener("click", () => {
const email = document.getElementById("email").value;
const pass = document.getElementById("password").value;

// ログイン成否の判定
signInWithEmailAndPassword(auth, email, pass)
    .then(() => {
    window.location.href = "mainMenu.html";
    })
    .catch((error) => {
    document.getElementById("errorMsg").textContent = "ログイン失敗：" + error.message;
    });
});