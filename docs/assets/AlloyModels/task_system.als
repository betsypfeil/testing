/** Ele Task System, modeled as a State machine on task state changes. */

module task_system

open util/ordering[State] as ord

/* Define a Task object */
sig Task {}

/* Define a State as a set of relations to Tasks. */
sig State {
  not_accepted: set Task, // pool of tasks added by users
  pending: set Task, // waiting to be run
  active: set Task, // being run
  done: set Task, // successfully run
  failed: set Task, // system failed at some point
  cancelled: set Task // do not run
}

/* Tasks are always in some relation for each state (never floating outside the state machine) */
fact {
  all t: Task, s: State | t in s.not_accepted + s.pending + s.active + s.failed + s.done + s.cancelled
}

/* Tasks are always in exactly one relation for each state */
/* there is likely a more compact way to model this.... partition the tasks across all relations per state */
fact {
  no t: Task, s: State | t in s.not_accepted && t in s.pending + s.active + s.failed + s.done + s.cancelled
  no t: Task, s: State | t in s.pending && t in s.not_accepted + s.active + s.failed + s.done + s.cancelled
  no t: Task, s: State | t in s.active && t in s.not_accepted + s.pending + s.failed + s.done + s.cancelled
  no t: Task, s: State | t in s.done && t in s.not_accepted + s.pending + s.active + s.failed + s.cancelled
  no t: Task, s: State | t in s.failed && t in s.not_accepted + s.pending + s.active + s.done + s.cancelled
  no t: Task, s: State | t in s.cancelled && t in s.not_accepted + s.pending + s.active + s.failed + s.done
}

/* Specify the initial start state */
fact initialState {
  let s0 = ord/first |
    // All Tasks are in not_accepted
    no s0.pending &&
    no s0.active &&
    no s0.failed &&
    no s0.done &&
    no s0.cancelled
}

/* Define valid TaskState change rules */
fact stateTransition {
  all s: State, s': ord/next[s] {
    (s'.not_accepted in s.not_accepted)
    (s'.pending in s.pending + s.not_accepted + s.failed)
    (s'.active in s.active + s.pending)
	(s'.done in s.done + s.active)
    (s'.failed in s.failed + s.pending + s.active)
    (s'.cancelled in s.cancelled + s.pending + s.active + s.failed)
  }
}
/* In English:

Any of the following may occur between two consecutive States:
  A task:
    0. Remains in the same relation
    1. moves from not_accepted to Pending (or disappears to model non-durability?)
    2. moves from pending to active, failed or cancelled
    3. moves from active to done, failed or cancelled
    4. moves from failed to pending or cancelled
    (nothing moves out of done or cancelled)
*/

// Let's see what kind of state machine exist
pred task_system {}

pred all_tasks_terminate {
	no t: Task | no s: State | t in s.done + s.failed + s.cancelled
}

//run task_system for 6 State, 3 Task
run all_tasks_terminate for 6 State, 3 Task

/*

Other Things to Model
=============

* Add another State relation, is_frozen -> True/False, which
  effects what kinds of transitions may occur

* Checkpoints (NotDone, Done) as a set in each Task, ordered per Task. 
   All Undone checkpoints come before Done checkpoints. All Done tasks 
   have their Checkpoints all Done, etc.  
   Not sure there is anything interesting to model here without introducing more
   parts of the system.

* Some parts of the system can be modelled without using a state machine perspective.

Open Questions
=========

* Active (and Pending?) can transition to Failed. Do we want to model
  different kinds of failures?

* NotAccepted tasks can be lost. Is it useful to model that here?

* Do we want to model any other task states, such as local or cached
  storage?

* Do we want to model a lock service (see ${tasktype}.${queuenumber})

General Questions
===========

* How do Controllers know which of their tasks are theirs? What is the
  relationship between controllers and workers? Is there anything
  interesting to model about controllers beyond moving Pending -> Active
  -> Done, Failed
  * yes, what about modeling that a Task may be run twice?

* What is the AccountTask queue and is that relevant to this mdoel?

* Shold we model TaskTypes, and thus the movement of Tasks onto certain
  Worker queues?

* What does Checkout and Update mean for tasks?

* Should we model checkpoints?

*/
