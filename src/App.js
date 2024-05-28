import MAP from './Components/map'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <div>
      <Router>
        <Routes>
          <Route path="/" element={<MAP />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
