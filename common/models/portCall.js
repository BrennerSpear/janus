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
      id: call.id,
      vessel: call.vessel,
      port: call.port,
      eta: call.eta,
      etd: call.etd,
      nextStop: null,
      transStops: []
    }
    routes[routeId].stops.push(stop)
  }

  routes.forEach(route => {
    for(var i=0; i<route.stops.length-1; i++) {
      var stop = route.stops[i]
      stop.nextStop = route.stops[i+1]
    }
  })
  return routes
}


const addTransStops = function(routes) {

  //need to get to stops, which are in routes...
  for(var i=0; i<routes.length; i++) {

    var stops = routes[i].stops
    for (var j=0; j<stops.length; j++) {

      var stop = stops[j]
      //only want to check on the OTHER routes
      for(var k=i+1; k<routes.length; k++) {

        var otherStops = routes[k].stops
        for(var l=0; l<otherStops.length; l++) {

          var otherStop = otherStops[l]
          //if they stop at the same port, they might be overlapping!
          //and they have to be coming from somewhere
          if(stop.port === otherStop.port && stop.eta && otherStop.eta) {
            //basically uses merge-interval logic to see if they overlap
            var [earlierStop, laterStop] = Date.parse(stop.eta) <= Date.parse(otherStop.eta)? [stop, otherStop] : [otherStop, stop]
            if(earlierStop.etd > laterStop.eta) {
              //add the transStops to each other
              stop.transStops.push(otherStop)
              otherStop.transStops.push(stop)
            }
          }
        }
      }
    }
  }
}

const addTransVoyages = function(stop, transStops) {
  var transVoyages = []

  for(var i=0; i<transStops.length; i++) {
    var currentStop = transStops[i]
    //the stop & current stop start the same
    //we want all the stops after that
    while(currentStop.nextStop) {
      if(stop.port !== currentStop.nextStop.port) {
        var transVoyage = {
          //this doesn't account for if there's a third vessel...
          vessel: [stop.vessel, currentStop.nextStop.vessel],
          departurePort: stop.port,
          departureDate: stop.etd,
          arrivalPort:   currentStop.nextStop.port,
          arrivalDate:   currentStop.nextStop.eta,
          transShipment: true
        }
        transVoyages.push(transVoyage)
      }
      //recursively go through the transStops if there are any
      if(currentStop.nextStop.transStops.length>0) {
        var moreTransVoyages = addTransVoyages(stop, currentStop.nextStop.transStops)
        transVoyages.push(...moreTransVoyages)
      }
      currentStop = currentStop.nextStop
    }
  }

  return transVoyages
}

const stopsToVoyages = function(stops) {
  var voyages = []

  for(var i=0; i<stops.length; i++) {
    console.log('a stop', stops[i], '\n')
    for(var j=i+1; j<stops.length; j++) {
      if(stops[i].port !== stops[j].port) {
        var voyage = {
          vessel: stops[i].vessel,
          departurePort: stops[i].port,
          departureDate: stops[i].etd,
          arrivalPort:   stops[j].port,
          arrivalDate:   stops[j].eta,
          transShipment: false
        }
        voyages.push(voyage)

        if(stops[j].transStops.length>0) {
          var transVoyages = addTransVoyages(stops[i], stops[j].transStops)
          voyages.push(...transVoyages)
        }
      }
    }
  }

  return voyages
}

const routesToVoyages = function(routes) {
  var legitRoutes = routes.filter(route => {return route.stops.length>1})
  var voyages = []

  for(var i=0; i<legitRoutes.length; i++) {
    var route =legitRoutes[i]
    var voyagesFromStops = stopsToVoyages(route.stops)
    voyages.push(...voyagesFromStops)

  }

  return voyages
}

const cleanVesselNames = function(voyages) {
  voyages.forEach(voyage => {
    if(Array.isArray(voyage.vessel)) {
      voyage.vessel = voyage.vessel.join(', ')
    }
  })
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

        var routes = callsToRoutes(calls)
        addTransStops(routes)
        var voyages = routesToVoyages(routes)
        cleanVesselNames(voyages)

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
