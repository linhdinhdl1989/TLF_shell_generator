import { Link } from "react-router-dom";

export default function Studies() {
  return (
    <div>
      <h1>Studies</h1>
      <ul>
        <li>
          <Link to="/studies/xyz101">Study XYZ-101</Link>
        </li>
      </ul>
    </div>
  );
}
