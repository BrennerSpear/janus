angular
  .module('app')
  .controller('VoyagesCtrl', VoyagesCtrl)

function VoyagesCtrl($log, PortCall) {

  let ctrl = this;

  ctrl.allVoyages = [];
  ctrl.filteredVoyages = [];

  ctrl.dateOptions = {
    initDate: new Date(2016, 00, 01),
    formatYear: 'yy',
    startingDay: 1
  };

  ctrl.getRoutes = (etd, eta) => {
    const params = { etd, eta };

    PortCall.getRoutes(params).$promise
      .then(voyages => {
        ctrl.allVoyages = voyages;
        ctrl.filteredVoyages = voyages.filter(voyage => {
          return !voyage.transShipment
        })
      })
      .catch(err => {
        $log.error(err);
      });
  };



}

VoyagesCtrl.$inject = ['$log', 'PortCall'];
