# State and concurrency lens: review

A finding, with the interleaving or the crash point that breaks it: check-then-write with no lock or
atomic op; two writers on one file or key; a step that is wrong on rerun or after a crash; a partial
update a reader can see; a new boolean or mode that has to agree with an existing one.
