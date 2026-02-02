// map/updateVisibleHouses.js

function updateVisibleHouses() {
  if (!this.map) return;

  const bounds = this.map.getBounds();
  if (!bounds) return;

  this.markers.forEach(m => m.setMap(null));
  this.markers = [];

  this.houses.forEach(house => {
    const lat = parseFloat(house.CSVLat);
    const lng = parseFloat(house.CSVLng);
    if (isNaN(lat) || isNaN(lng)) return;

    const pos = new google.maps.LatLng(lat, lng);

    if (bounds.contains(pos)) {
      const marker = new google.maps.Marker({
        position: pos,
        map: this.map,
        icon: this.getMarkerIcon(house.VisitStatus),
        title: house.Address || "",
      });

      marker.houseData = house;

      marker.addListener("click", () => {
        this.highlightMarker(marker);
      });

      this.markers.push(marker);
    }
  });

  if (this.activeMarker) {
    const target = this.markers.find(
      m => m.houseData.ID === this.activeMarker.houseData.ID
    );
    if (target) {
      this.highlightMarker(target);
    }
  }
}