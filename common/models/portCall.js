'use strict';

//assumes ordered by routeId asc, eta asc
//turns it them into linked lists, basically
const addNextPort = function(calls) {
  var call
  var nextCall
  for(var i=0; i<calls.length-1; i++) {
    call = calls[i]
    call.transCalls = []
    nextCall = calls[i+1]
    if(call.routeId === nextCall.routeId) {
      call.nextCall = nextCall
    }
  }
}

// add connections that cross ports at the same time
const addTransCalls = function(calls) {
  var call
  var otherCall
  for(var i=0; i<calls.length-1; i++) {
    call = calls[i]
    for(var j=i+1; j<calls.length-1; j++) {
      otherCall = calls[j]

      if(call.routeId !== otherCall.routeId
      && call.port === otherCall.port
      && call.eta && otherCall.eta) {

        //This assumes both ships have to be at the port at the same time
        //It's possible we could store the shipments somewhere at/near the port
        //but we'd have to change this
        var [earlierCall, laterCall] = Date.parse(call.eta) <= Date.parse(otherCall.eta)? [call, otherCall] : [otherCall, call]
        if(Date.parse(earlierCall.etd) > Date.parse(laterCall.eta)) {
          call.transCalls.push(otherCall)
          otherCall.transCalls.push(call)
        }
      }
    }
  }
}

const callToVoyages = function(call, startCall, vessels) {
  var voyages = []
  var currentCall = call
  var startCall = startCall || call
  var vessels = vessels || []

  //deal with multi-transshipments that have 2+ vessels
  if(!vessels.includes(currentCall.vessel)) {
    vessels.push(currentCall.vessel)
  }

  while(currentCall.nextCall) {

    currentCall = currentCall.nextCall
    //add the normal 'next' port
    if(startCall.port !== currentCall.port) {
      var voyage = {
        vessel: vessels,
        departurePort: startCall.port,
        departureDate: startCall.etd,
        arrivalPort: currentCall.port,
        arrivalDate: currentCall.eta,
        transShipment: (vessels.length>1)
      }
      voyages.push(voyage)
    }
    //if there are any transCalls, recursively get those voyages
    //this can handle infinite (okay maybe just 'a lot of') transconnections
    if(!!currentCall.transCalls) {
      for(var i=0; i<currentCall.transCalls.length; i++) {
        var transCall = currentCall.transCalls[i]
        var transVoyages = callToVoyages(transCall, startCall, vessels.slice())
        voyages.push(...transVoyages)
      }
    }
  }

  return voyages
}

//starting voyages from every port call
const callsToVoyages = function(calls) {
  var voyages = []

  for(var i=0; i<calls.length-1; i++) {
    voyages.push(...callToVoyages(calls[i]))
  }
  return voyages
}

const cleanVesselNames = function(voyages) {
  voyages.forEach(voyage => {
      voyage.vessel = voyage.vessel.join(', ')
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
      },
      //so we can loop through without worrying if we're missing something
      order: ['routeId ASC', 'eta ASC']
    };

    PortCall.find(query)
      .then(calls => {
        addNextPort(calls)
        addTransCalls(calls)
        var voyages = callsToVoyages(calls)
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
