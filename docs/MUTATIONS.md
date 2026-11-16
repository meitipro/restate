# Mutations

Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. 65 defences in
`contracts/restate.py` were each broken on their own, and every mutant was caught. Each row
names the first test that failed against it, read from pytest's report rather than an exit code.
The generated-files, frozen-deployment and private-key tests are excluded, because the first two
fail for any edit at all and the last reads files, not the contract.

One check is deliberately not mutated: the validator's test that the leader's payload is a dict
with a label from the closed set. The label comparison right below it already refuses anything
else, so no test can tell the two apart; it stays so the validator never depends on how the
runtime treats an exception raised inside it.

| # | defence broken | caught by |
|---|---|---|
| 1 | restate: any account may restate | `tests/test_direct.py::test_only_the_restater_may_restate` |
| 2 | rebut: any account may reply | `tests/test_direct.py::test_only_the_side_whose_restatement_was_fair_may_reply` |
| 3 | confirm: any account may confirm | `tests/test_direct.py::test_only_the_author_of_the_original_may_confirm` |
| 4 | contest: any account may contest | `tests/test_direct.py::test_only_the_author_of_the_original_may_contest` |
| 5 | open_thread: the thread is authored by a fixed address | `tests/test_direct.py::test_open_thread_records_the_position_and_the_deposit` |
| 6 | join: the opponent is not recorded | `tests/test_direct.py::test_join_starts_the_first_turn` |
| 7 | join: the author may join their own thread | `tests/test_direct.py::test_the_author_cannot_join_their_own_thread` |
| 8 | withdraw: pays a fixed address | `tests/test_direct.py::test_both_deposits_come_back_when_both_restatements_are_fair` |
| 9 | judge: the caller is not recorded | `tests/test_direct.py::test_a_fair_label_unlocks_the_reply` |
| 10 | fair: the closer is not recorded | `tests/test_direct.py::test_the_author_restates_the_rebuttal_and_the_joiner_answers` |
| 11 | forfeit: the closer is not recorded | `tests/test_direct.py::test_two_failures_forfeit_the_deposit_to_the_other_side` |
| 12 | join: any deposit is accepted | `tests/test_direct.py::test_join_needs_the_same_deposit` |
| 13 | open_thread: any deposit is accepted | `tests/test_direct.py::test_open_thread_refuses_out_of_range_settings[kwargs7-the` |
| 14 | open_thread: no deposit cap | `tests/test_direct.py::test_open_thread_refuses_out_of_range_settings[kwargs9-the` |
| 15 | withdraw: the balance is not zeroed | `tests/test_direct.py::test_both_deposits_come_back_when_both_restatements_are_fair` |
| 16 | withdraw: an empty balance still sends | `tests/test_direct.py::test_withdraw_with_nothing_is_refused` |
| 17 | credit: a balance is overwritten, not added to | `tests/test_direct.py::test_balances_always_add_up_across_a_busy_day` |
| 18 | done: the author's deposit does not come back | `tests/test_direct.py::test_both_deposits_come_back_when_both_restatements_are_fair` |
| 19 | done: the joiner's deposit does not come back | `tests/test_direct.py::test_both_deposits_come_back_when_both_restatements_are_fair` |
| 20 | forfeit: the winner takes only their own deposit | `tests/test_direct.py::test_two_failures_forfeit_the_deposit_to_the_other_side` |
| 21 | forfeit: the loser's deposit goes to the loser | `tests/test_direct.py::test_two_failures_forfeit_the_deposit_to_the_other_side` |
| 22 | closed: the author's deposit does not come back | `tests/test_direct.py::test_a_thread_nobody_joins_closes_and_the_author_gets_the_deposit_back` |
| 23 | restate: allowed after the window | `tests/test_direct.py::test_restate_after_the_window_is_refused` |
| 24 | rebut: allowed after the window | `tests/test_direct.py::test_the_reply_after_the_window_is_refused` |
| 25 | restate: a second restatement while one waits | `tests/test_direct.py::test_a_restatement_waits_for_an_answer_before_another` |
| 26 | restate: allowed while the reply is the move | `tests/test_direct.py::test_restate_is_not_the_reply` |
| 27 | rebut: the reply is unlocked without a FAIR restatement | `tests/test_direct.py::test_a_failed_label_uses_a_try_and_the_reply_stays_locked[INCOMPLETE]` |
| 28 | confirm: confirms with nothing to confirm | `tests/test_direct.py::test_confirm_needs_a_restatement` |
| 29 | contest: contests with nothing to contest | `tests/test_direct.py::test_contest_needs_a_restatement` |
| 30 | judge: silence counts as accepting, never contesting | `tests/test_direct.py::test_an_author_who_stays_silent_counts_as_contesting` |
| 31 | judge: silence counts before the window ends | `tests/test_direct.py::test_nothing_waits_to_be_judged_until_contested` |
| 32 | judge: anything can be judged | `tests/test_direct.py::test_nothing_waits_to_be_judged_until_contested` |
| 33 | judge: a FAIR label does not unlock the reply | `tests/test_direct.py::test_a_fair_label_unlocks_the_reply` |
| 34 | judge: a failure is not counted | `tests/test_direct.py::test_a_failed_label_uses_a_try_and_the_reply_stays_locked[INCOMPLETE]` |
| 35 | rules: three tries | `tests/test_direct.py::test_join_starts_the_first_turn` |
| 36 | judge: the first failure forfeits | `tests/test_direct.py::test_a_failed_label_uses_a_try_and_the_reply_stays_locked[INCOMPLETE]` |
| 37 | judge: a failed try is not kept | `tests/test_direct.py::test_a_failed_label_uses_a_try_and_the_reply_stays_locked[INCOMPLETE]` |
| 38 | judge: a failed try does not reset the window | `tests/test_direct.py::test_a_try_resets_the_window` |
| 39 | restate: a try is not counted | `tests/test_direct.py::test_the_joiner_restates_inside_the_window` |
| 40 | restate: the answer window does not start | `tests/test_direct.py::test_a_restatement_starts_the_authors_answer_window_from_that_moment` |
| 41 | fair: the reply has no window | `tests/test_direct.py::test_a_fair_restatement_starts_the_replys_window_from_that_moment` |
| 42 | fair: the thread never ends | `tests/test_direct.py::test_the_author_restates_the_rebuttal_and_the_joiner_answers` |
| 43 | rules: three turns | `tests/test_direct.py::test_the_author_restates_the_rebuttal_and_the_joiner_answers` |
| 44 | rebut: the author does not restate the rebuttal | `tests/test_direct.py::test_the_reply_opens_the_second_turn_for_the_author_to_restate` |
| 45 | rebut: the 800-character cap is gone | `tests/test_direct.py::test_a_reply_is_a_bounded_text` |
| 46 | restate: the 800-character cap is gone | `tests/test_direct.py::test_a_restatement_is_a_bounded_text` |
| 47 | claim_forfeit: a missed window is not checked | `tests/test_direct.py::test_a_silent_restater_forfeits_after_the_window` |
| 48 | claim_forfeit: an unjoined thread closes at once | `tests/test_direct.py::test_a_thread_nobody_joins_closes_and_the_author_gets_the_deposit_back` |
| 49 | claim_forfeit: a silent replier does not forfeit | `tests/test_direct.py::test_a_silent_replier_forfeits_after_the_window` |
| 50 | claim_forfeit: a silent restater does not forfeit | `tests/test_direct.py::test_a_silent_restater_forfeits_after_the_window` |
| 51 | claim_forfeit: a restatement waiting for an answer forfeits | `tests/test_direct.py::test_a_restatement_waiting_for_an_answer_never_forfeits` |
| 52 | join: allowed after the window | `tests/test_direct.py::test_join_after_the_window_is_refused` |
| 53 | join: a thread can be joined twice | `tests/test_direct.py::test_a_thread_has_one_joiner` |
| 54 | join: the first turn goes to the wrong restater | `tests/test_direct.py::test_join_starts_the_first_turn` |
| 55 | join: the thread does not become active | `tests/test_direct.py::test_join_starts_the_first_turn` |
| 56 | open_thread: the 80-character topic cap is gone | `tests/test_direct.py::test_open_thread_refuses_out_of_range_settings[kwargs1-topic` |
| 57 | open_thread: the 800-character position cap is gone | `tests/test_direct.py::test_open_thread_refuses_out_of_range_settings[kwargs4-position` |
| 58 | open_thread: any window is accepted | `tests/test_direct.py::test_open_thread_refuses_out_of_range_settings[kwargs5-the` |
| 59 | moves on a finished thread are accepted | `tests/test_direct.py::test_nothing_to_restate_before_anyone_joins` |
| 60 | judge: the fence lets delimiters through | `tests/test_direct.py::test_hostile_text_cannot_close_its_block` |
| 61 | judge: the original is not fenced | `tests/test_direct.py::test_hostile_text_cannot_close_its_block` |
| 62 | judge: the restatement is not fenced | `tests/test_direct.py::test_hostile_text_cannot_close_its_block` |
| 63 | judge: validators agree with any answer | `tests/test_direct.py::test_validators_must_agree_on_the_label` |
| 64 | judge: an unreadable label defaults to FAIR | `tests/test_direct.py::test_an_unreadable_answer_is_never_a_label[{"verdict":` |
| 65 | judge: a formatting slip is never retried | `tests/test_direct.py::test_a_formatting_slip_gets_exactly_one_retry` |
