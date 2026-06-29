
import styled from 'styled-components';

const OverAllButton = () => {
  return (
    <StyledWrapper>
      <button className="btn">Diagonal Swipe</button>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .btn {
    color: purple;
    text-transform: uppercase;
    text-decoration: none;
    border: 2px solid purple;
    padding: 10px 20px;
    font-size: 17px;
    cursor: pointer;
    font-weight: bold;
    background: transparent;
    position: relative;
    transition: all 1s;
    overflow: hidden;
  }

  .btn:hover {
    color: white;
  }

  .btn::before {
    content: "";
    position: absolute;
    height: 100%;
    width: 0%;
    top: 0;
    left: -40px;
    transform: skewX(45deg);
    background-color: purple;
    z-index: -1;
    transition: all 1s;
  }

  .btn:hover::before {
    width: 160%;
  }`;

export default OverAllButton;
