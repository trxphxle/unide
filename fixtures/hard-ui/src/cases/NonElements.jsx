import Case from '../Case.jsx';

export default function NonElements() {
  return (
    <>
      <Case id="N1" title="Native select popup" how="Open the select. Its option list is drawn by the OS, not the page.">
        <select defaultValue="m"><option value="s">Small</option><option value="m">Medium</option><option value="l">Large — the long option</option></select>
      </Case>
      <Case id="N2" title="::before / ::after decoration" how="The star and the NEW badge are pseudo-elements of one span.">
        <span className="price">$24 / month</span>
      </Case>
      <Case id="N3" title="One word inside a paragraph" how="Point at “quarterly” only, not the whole paragraph.">
        <p className="prose">Your plan renews every month. Switch to quarterly billing to save 8% and get one invoice per quarter.</p>
      </Case>
    </>
  );
}
