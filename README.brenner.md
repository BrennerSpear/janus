## First solution

I began by converting calls into routes, and then routes into all the permutations of the voyages. This works for non-transshipments fine. Adding transshipments required me to treat it more like a graph. There were a few things that wouldn't scale in this case, such as including all vessel names.

## Second solution

Treating the port calls like nodes from the beginning I added 'next' nodes to each of them based on their routes. In the same way, I added transshipment port calls based on when ships were at the same port at the same time.

I changed portCall 12's eta from 01-20 to 01-19 so there was a day of overlap with portCall 9. In production the amount of overlap will matter and users should be able to specify how much time they need to move over the goods. It's also possible that the goods could be stored at the port/ near the port for some amount of time. But for now, it's configured so that the two ships have to be there at the same time for a transshipment to happen.

All of the work of converting port calls to voyages is done here on the client side. In production it would be better to run these types of conversions as a background job as port calls get added and save all the voyages in DB to be queried.