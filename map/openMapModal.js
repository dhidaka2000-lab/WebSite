// map/openMapModal.js

function openMapModal(house) {
  const lat = parseFloat(house.CSVLat || this.childInfo.CSVLat || 34.6937);
  const lng = parseFloat(house.CSVLng || this.childInfo.CSVLng || 135.5023);
  const kmlUrl = this.childInfo.KMLURL;

  $('#mapModal').modal('show');

  this.$nextTick(() => {
    const mapEl = document.getElementById("mapModalContainer");
    if (!mapEl || !window.google) return;

    this.map = new google.maps.Map(mapEl, {
      center: { lat, lng },
      zoom: 18,
    });

    this.infoWindow = new google.maps.InfoWindow();
    this.activeMarker = null;

    if (kmlUrl) {
      this.kmlLayer = new google.maps.KmlLayer({
        url: kmlUrl,
        map: this.map,
        preserveViewport: false,
      });

      google.maps.event.addListener(this.kmlLayer, "defaultviewport_changed", () => {
        const bounds = this.kmlLayer.getDefaultViewport();
        if (bounds) {
          this.map.fitBounds(bounds);
        }
      });
    }

    this._initialCenterHouse = house;

    google.maps.event.addListener(this.map, "idle", () => {
      this.updateVisibleHouses();

      if (this._initialCenterHouse) {
        const target = this.markers.find(
          m => m.houseData.ID === this._initialCenterHouse.ID
        );
        if (target) {
          this.highlightMarker(target);
        }
        this._initialCenterHouse = null;
      }
    });
  });
}