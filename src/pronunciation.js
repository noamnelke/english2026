// Topic IDs keep the voice stable even if the topic list is reordered.
export const voiceForTopic = topicId => Number(topicId.split('-').at(-1)) % 2 ? 'marin' : 'cedar';
export const spokenText = word => word.split('/')[0].replace(/\.\.\./g, '').replace(/[()]/g, '').replace(/\s+([?!.,])/g, '$1').trim();
