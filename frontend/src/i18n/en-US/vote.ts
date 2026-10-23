/** Namespace `vote`. */
export default {
  title: 'Vote',
  subtitle: 'Elections open for your vote, and the results of proclaimed elections. Your ballot is anonymous.',
  loading: 'Loading elections…',
  errors: {
    load: 'Unable to load elections.',
    submit: 'Unable to submit ballot.',
    max_seats_one: 'Only one seat is available: uncheck your current choice first.',
    max_seats: 'You can select at most {n} candidates.',
  },
  empty_state: {
    title: 'No election at the moment',
    message: 'No election is open and no result has been proclaimed yet. You will be notified when the next election opens.',
    my_space: 'My space',
  },
  list: {
    title: 'Elections',
    subtitle: 'Choose the election to view or take part in.',
    seat: 'seat',
    seats: 'seats',
    closes_on: 'closes on {date}',
  },
  detail: {
    period: 'from {debut} to {fin}',
    already_voted: 'Your ballot was submitted on {date}. Thank you for your participation.',
    ballot_reference: 'Anonymous reference of your ballot:',
    ballot_reference_hint: '— it proves the submission without revealing your choice.',
    one_ballot_only: 'Only one ballot is accepted per voter: you can no longer vote in this election.',
    closed_notice: 'This election is {statut}: no more ballots are accepted. Results are shown below.',
    anonymous_notice:
      'Your vote is anonymous: your ballot is never linked to your name. Only the fact that you voted is kept, to prevent a second ballot. Submission is final.',
    seats_to_fill: 'seat{plural} to fill — select from 1 to {n} candidate{plural}.',
    selection_status: '{selected} selected, {remaining} remaining.',
    no_candidates: 'No candidate is registered for this election: voting is not yet possible.',
    select_candidate: 'Select {name}',
    candidate_number: 'No. {n}',
    select_at_least_one: 'Select at least one candidate to submit your ballot.',
    print_ballot: 'Print a paper ballot',
    print_ballot_tooltip: 'Blank ballot to print for in-person voting (new tab)',
    submit_ballot: 'Submit my ballot',
  },
  confirm_dialog: {
    title: 'Submit my ballot',
    message:
      'You are voting for: {names}.  The vote is final: once the ballot is submitted, it cannot be modified or withdrawn, and you will not be able to vote in this election again. Your choice is anonymous: only the fact that you voted is kept.',
    confirm: 'Submit my ballot',
  },
  messages: {
    ballot_submitted: 'Ballot submitted — thank you for your participation.',
  },
  results: {
    loading: 'Loading results…',
    title: 'Results',
    summary: 'Ballots cast: {ballots} · votes cast: {votes} · seats to fill: {seats}',
    elected: 'Elected',
    votes_count: '{n} votes',
  },
};
