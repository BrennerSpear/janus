'use strict';

//Need to take care of gaps in routesId ([route, undefined, route])
const callsToRoutes = function(calls) {
  var routes = []
  var call
  var routeId
  for(var i=0; i<calls.length; i++) {
    call = calls[i]
    //cheap way to deal with empty routes[0]
    routeId = call.routeId - 1

    if(routes[routeId] === undefined) {
      var route = {
        routeId: routeId,
        vessel: call.vessel,
        stops: []
      }
      routes[routeId] = route
    }

    var stop = {
      port: call.port,
      eta: call.eta,
      etd: call.etd
    }
    routes[routeId].stops.push(stop)
  }

  return routes
}

const stopsToVoyages = function(stops, vessel) {
  var voyages = []

  for(var i=0; i<stops.length; i++) {
    for(var j=i+1; j<stops.length; j++) {
      var voyage = {
        vessel: vessel,
        departurePort: stops[i].port,
        departureDate: stops[i].etd,
        arrivalPort:   stops[j].port,
        arrivalDate:   stops[j].eta
      }
      voyages.push(voyage)
    }
  }

  return voyages
}

const routesToVoyages = function(routes) {
  var voyages = []
  var route

  for(var i=0; i<routes.length; i++) {
    route = routes[i]

    if(route.stops.length > 1) {
      var voyagesFromStops = stopsToVoyages(route.stops, route.vessel)
      voyages.push(...voyagesFromStops)
    }

  }

  return voyages
}

module.exports = function(PortCall) {

  PortCall.getRoutes = function(etd, eta, cb) {
    // For more information on how to query data in loopback please see
    // https://docs.strongloop.com/display/public/LB/Querying+data
    const query = {
      where: {
        and: [
          { // port call etd >= etd param, or can be null
            or: [{ etd: { gte: etd } }, { etd: null }]
          },
          { // port call eta <= eta param, or can be null
            or: [{ eta: { lte: eta } }, { eta: null }]
          }
        ]
      }
    };

    PortCall.find(query)
      .then(calls => {
        const routes = callsToRoutes(calls)
        const voyages = routesToVoyages(routes)
        console.log(voyages);

        return cb(null, voyages);
      })
      .catch(err => {
        console.log(err);

        return cb(err);
      });
  };

  PortCall.remoteMethod('getRoutes', {
    accepts: [
      { arg: 'etd', 'type': 'date' },
      { arg: 'eta', 'type': 'date' }
    ],
    returns: [
      { arg: 'routes', type: 'array', root: true }
    ]
  });

};
