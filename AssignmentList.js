import { auth, onAuthStateChanged, signOut } from "./firebase.js";
const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const screenWidth = ref(window.innerWidth);
    const cardsNumbers = ref(0);
    const childs = ref([]);
    const selectedChild = ref(null);
    const modalInstance = ref(null);

    // ログインユーザー情報
    const userEmail = ref("");
    const userName = ref("");
    const userGroup = ref("");
    const userrole = ref(0);

    // ステータス色
    const statusClass = (child) => {
      switch (child.CHILDSTATUS) {
        case "貸出中":
          return "bg-warning text-black";
        case "返却済":
          return "bg-info text-white";
        case "貸出可能":
          return "bg-success text-white";
        default:
          return "bg-secondary text-white";
      }
    };

    // ログアウト処理
    const logout = () => {
      signOut(auth).then(() => {
        window.location.href = "index.html";
      });
    };

    // ページ遷移
    const go = (page) => {
      window.location.href = page + ".html";
    };

    // Firebase ログイン状態監視
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      // ログインユーザー情報をセット
      userEmail.value = user.email;
      userName.value = user.displayName ?? "unknown";
      userGroup.value = "いちじく"; // 必要なら Firestore から取得
      userrole.value = 9001;
    });

    // モーダル表示
    const openModal = (type, child) => {
      selectedChild.value = child;
      if (!modalInstance.value) {
        modalInstance.value = new bootstrap.Modal(
          document.getElementById("childModal")
        );
      }
      modalInstance.value.show();
    };

    const closeModal = () => {
      modalInstance.value?.hide();
    };

    const goToMap = (child) => {
      console.log("goToMap:", child);
      // TODO: 地図ページへ遷移
    };

    const printChildMap = (child) => {
      console.log("printChildMap:", child);
      // TODO: 印刷ページへ遷移
    };

    const handleResize = () => {
      screenWidth.value = window.innerWidth;
    };

    // GAS からデータ取得（キャッシュ対応）
    const fetchChildCards = async () => {

      const CACHE_KEY = "childCardCache";
      const CACHE_EXPIRE = 300 * 60 * 1000; // 300分（5時間）

      // --- キャッシュがあれば即表示 ---
      const cache = localStorage.getItem(CACHE_KEY);
      if (cache) {
        const parsed = JSON.parse(cache);

        if (Date.now() - parsed.timestamp < CACHE_EXPIRE) {
          console.log("キャッシュから読み込み");
          childs.value = parsed.items;
          cardsNumbers.value = parsed.items.length;

          document.getElementById("loading").style.display = "none";

          // 裏で最新データを取得
          fetchFromGAS(false);
          return;
        }
      }

      // キャッシュなし → GAS から取得
      fetchFromGAS(true);
    };


    // --- GAS から強制取得する関数（更新ボタンもここを使う） ---
    const fetchFromGAS = async (hideLoading) => {

      const url =
        "https://script.google.com/macros/s/AKfycbw9ONyKBLAzL_DunjAjsUPAmUQ3E3W2wwAvDw88eL6blTxpHR5_w-fOCLoOW1hw7a3r/exec"
        + "?funcName=getFilteredChildCardbyUser"
        + "&userName=" + encodeURIComponent(userName.value)
        + "&t=" + Date.now();

      try {
        const response = await fetch(url);
        const data = await response.json();

        console.log("GAS 最新データ:", data);

        if (data && Array.isArray(data.items)) {

          // Vue に反映
          childs.value = data.items;
          cardsNumbers.value = data.items.length;

          // キャッシュ保存
          localStorage.setItem("childCardCache", JSON.stringify({
            timestamp: Date.now(),
            items: data.items
          }));

          if (hideLoading) {
            document.getElementById("loading").style.display = "none";
          }
          return;
        }

        console.error("GAS API の戻り値が想定外:", data);

      } catch (error) {
        console.error("GAS API の取得に失敗:", error);
      }

      if (hideLoading) {
        document.getElementById("loading").style.display = "none";
      }
    };

    // --- 手動更新（キャッシュ無視） ---
    const refresh = () => {
      document.getElementById("loading").style.display = "flex";
      fetchFromGAS(true);
    };

    onMounted(() => {
      window.addEventListener("resize", handleResize);

      // GAS API からデータ取得
      fetchChildCards();
    });

    return {
      screenWidth,
      cardsNumbers,
      childs,
      selectedChild,
      userEmail,
      userName,
      userGroup,
      userrole,
      statusClass,
      openModal,
      closeModal,
      goToMap,
      printChildMap,
      logout,
      go,
      refresh
    };
  }
}).mount("#app");