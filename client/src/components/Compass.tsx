type Props = {
  heading: number;
};

/** Rotating compass rose; heading is degrees clockwise from north (Street View POV). */
export default function Compass({ heading }: Props) {
  return (
    <div className="compass" aria-label={`Heading ${Math.round(heading)} degrees`}>
      <div className="compass-ring" style={{ transform: `rotate(${-heading}deg)` }}>
        <span className="compass-n">N</span>
        <span className="compass-e">E</span>
        <span className="compass-s">S</span>
        <span className="compass-w">W</span>
      </div>
      <div className="compass-needle" />
    </div>
  );
}
