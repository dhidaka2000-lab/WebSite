const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const screenWidth = ref(window.innerWidth);
    const cardsNumbers = ref(0);
    const childs = ref([]);
    const selectedChild = ref(null);
    const modalInstance = ref(null);

    const loginUser = ref("サンプル太郎");
    const loginUserGroup = ref("第1グループ");

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
      // TODO: GitHub Pages 用の地図ページへ遷移
    };

    const printChildMap = (child) => {
      console.log("printChildMap:", child);
      // TODO: 印刷ページへ遷移
    };

    const handleResize = () => {
      screenWidth.value = window.innerWidth;
    };

    onMounted(() => {
      window.addEventListener("resize", handleResize);

      // TODO: GAS API から取得する形に変更
      childs.value = [
        {
          CHILDID: 1,
          CHILDSTATUS: "貸出中",
          CHILDPARENTSTATUS: "貸出中",
          NICKNAMEFLAG: 1,
          NICKNAME: "北側アパート",
          CARDNO: "A-01",
          CHILDNO: "1",
          CHILDHOUSES: 30,
          VISITED: 10,
          CHILDLIMITDATE: "2026-01-31",
          CHILDBLOCK: "北1丁目",
          COLOR: "赤",
          bgCOLOR: "background-color: #ffdddd;"
        },
        {
          CHILDID: 2,
          CHILDSTATUS: "返却済",
          CHILDPARENTSTATUS: "返却済",
          NICKNAMEFLAG: 0,
          CARDNO: "A-02",
          CHILDNO: "1",
          CHILDHOUSES: 25,
          VISITED: 0,
          CHILDLIMITDATE: "2025-12-31",
          CHILDBLOCK: "南2丁目",
          COLOR: "青",
          bgCOLOR: "background-color: #dde8ff;"
        }
      ];

      cardsNumbers.value = childs.value.length;

      document.getElementById("loading").style.display = "none";
    });

    return {
      screenWidth,
      cardsNumbers,
      childs,
      selectedChild,
      loginUser,
      loginUserGroup,
      statusClass,
      openModal,
      closeModal,
      goToMap,
      printChildMap
    };
  }
}).mount("#app");