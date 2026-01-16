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

      // ★★★ サンプルデータをそのまま格納 ★★★
      childs.value = [
        {
          "CHILDID": 976,
          "CARDNO": 38,
          "CHILDNO": 1,
          "CHILDBLOCK": "【重点】xx町ーxx付近",
          "CHILDHOUSES": 36,
          "CHILDTERM": "2025年11月",
          "CHILDSTATUS": "貸出中",
          "CHILDPDF": "38-1xx町－xx付近.pdf",
          "CHILDKML": "038-01.kml",
          "CHILDLNG": "",
          "CHILDLAT": "",
          "CHILDGROUP": "いちじく",
          "CHILDARRENGER": "田中一郎",
          "CHILDMINISTER": "田中一郎",
          "CHILDSTARTDATE": "2025-11-01",
          "CHILDLIMITDATE": "2025-12-25",
          "CHILDCHECKOUTDATE": "2025-11-29",
          "CHILDRETURNDATE": "",
          "CHILDNEXTAVAILABLEDATE": "",
          "CHILDRENEW": "",
          "CHILDOVERDUE": "",
          "CHILDLOST": "",
          "CHILDATTACH1": "",
          "CHILDATTACH2": "",
          "CHILDATTACH3": "",
          "CHILDDESCRIPTION": "",
          "CHILDTIMESTAMP": "2025-11-29T12:46:45.000Z",
          "CHILDOPERATOR": "鈴木花子",
          "CHILDPARENTSTATUS": "貸出中",
          "BADFLAG": "",
          "BADCOMMENT": "",
          "BADTIMESTAMP": "",
          "BADOPERATOR": "",
          "BADDETAIL": 0,
          "HOME": 36,
          "BUSSINESS": 0,
          "AUTOLOCK": 0,
          "TELENABLED": 0,
          "UNCHECKEDNG": 0,
          "VISITED": 22,
          "YOUNGERGEN": 7,
          "CHILDCLASSIFY": 0,
          "FLAG1": 0,
          "FLAG2": 0,
          "NICKNAMEFLAG": 0,
          "NICKNAME": 0,
          "USERMEMO": 0,
          "COLOR": "★",
          "bgCOLOR": "backgroundColor:#00FF00",
          "BTN_UPDATE_LABEL": "更新",
          "BTN_UPDATE_STATUS": false,
          "BTN_cUPDATE_LABEL": "更新",
          "BTN_cUPDATE_STATUS": false
        },
        {
          "CHILDID": 982,
          "CARDNO": 38,
          "CHILDNO": 6,
          "CHILDBLOCK": "【重点】xx町ーxx付近",
          "CHILDHOUSES": 15,
          "CHILDTERM": "2025年11月",
          "CHILDSTATUS": "貸出中",
          "CHILDPDF": "38-6xx町－xx付近.pdf",
          "CHILDKML": "038-06.kml",
          "CHILDLNG": "",
          "CHILDLAT": "",
          "CHILDGROUP": "いちじく",
          "CHILDARRENGER": "田中一郎",
          "CHILDMINISTER": "田中一郎",
          "CHILDSTARTDATE": "2025-11-01",
          "CHILDLIMITDATE": "2026-01-25",
          "CHILDCHECKOUTDATE": "2025-12-30",
          "CHILDRETURNDATE": "",
          "CHILDNEXTAVAILABLEDATE": "",
          "CHILDRENEW": "",
          "CHILDOVERDUE": "",
          "CHILDLOST": "",
          "CHILDATTACH1": "",
          "CHILDATTACH2": "",
          "CHILDATTACH3": "",
          "CHILDDESCRIPTION": "",
          "CHILDTIMESTAMP": "2025-12-30T12:56:28.000Z",
          "CHILDOPERATOR": "鈴木花子",
          "CHILDPARENTSTATUS": "貸出中",
          "BADFLAG": "",
          "BADCOMMENT": "",
          "BADTIMESTAMP": "",
          "BADOPERATOR": "",
          "BADDETAIL": 0,
          "HOME": 15,
          "BUSSINESS": 0,
          "AUTOLOCK": 0,
          "TELENABLED": 0,
          "UNCHECKEDNG": 0,
          "VISITED": 1,
          "YOUNGERGEN": 4,
          "CHILDCLASSIFY": 0,
          "FLAG1": 0,
          "FLAG2": 0,
          "NICKNAMEFLAG": 0,
          "NICKNAME": 0,
          "USERMEMO": 0,
          "COLOR": "★",
          "bgCOLOR": "backgroundColor:#00FF00",
          "BTN_UPDATE_LABEL": "更新",
          "BTN_UPDATE_STATUS": false,
          "BTN_cUPDATE_LABEL": "更新",
          "BTN_cUPDATE_STATUS": false
        },
        {
          "CHILDID": 797,
          "CARDNO": 43,
          "CHILDNO": 6,
          "CHILDBLOCK": "【重点】xx町xx町側",
          "CHILDHOUSES": 20,
          "CHILDTERM": "2025年12月",
          "CHILDSTATUS": "貸出中",
          "CHILDPDF": "43-6xx町xx町側.pdf",
          "CHILDKML": "043-06.kml",
          "CHILDLNG": "",
          "CHILDLAT": "",
          "CHILDGROUP": "いちじく",
          "CHILDARRENGER": "田中一郎",
          "CHILDMINISTER": "田中一郎",
          "CHILDSTARTDATE": "2025-12-01",
          "CHILDLIMITDATE": "2026-01-25",
          "CHILDCHECKOUTDATE": "2025-12-30",
          "CHILDRETURNDATE": "",
          "CHILDNEXTAVAILABLEDATE": "",
          "CHILDRENEW": "",
          "CHILDOVERDUE": "",
          "CHILDLOST": "",
          "CHILDATTACH1": "",
          "CHILDATTACH2": "",
          "CHILDATTACH3": "",
          "CHILDDESCRIPTION": "",
          "CHILDTIMESTAMP": "2025-12-30T12:57:43.000Z",
          "CHILDOPERATOR": "鈴木花子",
          "CHILDPARENTSTATUS": "貸出中",
          "BADFLAG": "",
          "BADCOMMENT": "",
          "BADTIMESTAMP": "",
          "BADOPERATOR": "",
          "BADDETAIL": 2,
          "HOME": 20,
          "BUSSINESS": 0,
          "AUTOLOCK": 0,
          "TELENABLED": 2,
          "UNCHECKEDNG": 0,
          "VISITED": 20,
          "YOUNGERGEN": 2,
          "CHILDCLASSIFY": 0,
          "FLAG1": 0,
          "FLAG2": 0,
          "NICKNAMEFLAG": 0,
          "NICKNAME": 0,
          "USERMEMO": 0,
          "COLOR": "★",
          "bgCOLOR": "backgroundColor:#00FF00",
          "BTN_UPDATE_LABEL": "更新",
          "BTN_UPDATE_STATUS": false,
          "BTN_cUPDATE_LABEL": "更新",
          "BTN_cUPDATE_STATUS": false
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