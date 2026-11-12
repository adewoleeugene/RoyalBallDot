import { eventFacts } from '../../lib/event-view';

export default {
  /** From the share link. */
  pass: '',
  key: '',
  /** Fetching the pass from the share link. */
  loading: true,
  /** Why the pass couldn't be opened, '' when it could. */
  error: '',
  title: eventFacts.title,
  when: `${eventFacts.dateLabel} · ${eventFacts.timeLabel}`,
};
