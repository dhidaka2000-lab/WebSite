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
      userName.value = user.displayName ?? "ユーザー";
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

    // ③ GAS Web API からデータ取得
    const fetchChildCards = async () => {
      const url =
        "https://script.google.com/macros/s/AKfycbw9ONyKBLAzL_DunjAjsUPAmUQ3E3W2wwAvDw88eL6blTxpHR5_w-fOCLoOW1hw7a3r/exec?funcName=getFilteredChildCardbyUser";

      try {
        const response = await fetch(url);
        const data = await response.json();

        // 取得した JSON をそのまま代入
        childs.value = data;
        cardsNumbers.value = childs.value.length;
      } catch (error) {
        console.error("GAS API の取得に失敗:", error);
      }

      document.getElementById("loading").style.display = "none";
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
      logout, // ① 追加
      go      // ② 追加
    };
  }
}).mount("#app");