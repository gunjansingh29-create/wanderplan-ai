import React from 'react';

export default function YesNoCard({
  question,
  onYes = () => {},
  onNo = () => {},
  loading = false,
  yesLabel = 'Yes',
  noLabel = 'No',
}) {
  return (
    <div>
      {question !== undefined && <p>{question}</p>}
      <button onClick={onYes} disabled={loading}>{yesLabel}</button>
      <button onClick={onNo} disabled={loading}>{noLabel}</button>
    </div>
  );
}
