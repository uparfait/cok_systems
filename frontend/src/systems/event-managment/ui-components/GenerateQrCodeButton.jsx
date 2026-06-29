import styled from 'styled-components';

const GenerateQrCodeButton = () => {
  return (
    <StyledWrapper>
      <button>Squeeze me</button>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  button {
    height: 2.8em;
    width: 9em;
    background: transparent;
    -webkit-animation: jello-horizontal 0.9s both;
    animation: jello-horizontal 0.9s both;
    border: 2px solid #016dd9;
    outline: none;
    color: #016dd9;
    cursor: pointer;
    font-size: 17px;
  }

  button:hover {
    background: #016dd9;
    color: #ffffff;
    animation: squeeze3124 0.9s both;
  }

  @keyframes squeeze3124 {
    0% {
      -webkit-transform: scale3d(1, 1, 1);
      transform: scale3d(1, 1, 1);
    }

    30% {
      -webkit-transform: scale3d(1.25, 0.75, 1);
      transform: scale3d(1.25, 0.75, 1);
    }

    40% {
      -webkit-transform: scale3d(0.75, 1.25, 1);
      transform: scale3d(0.75, 1.25, 1);
    }

    50% {
      -webkit-transform: scale3d(1.15, 0.85, 1);
      transform: scale3d(1.15, 0.85, 1);
    }

    65% {
      -webkit-transform: scale3d(0.95, 1.05, 1);
      transform: scale3d(0.95, 1.05, 1);
    }

    75% {
      -webkit-transform: scale3d(1.05, 0.95, 1);
      transform: scale3d(1.05, 0.95, 1);
    }

    100% {
      -webkit-transform: scale3d(1, 1, 1);
      transform: scale3d(1, 1, 1);
    }
  }`;

export default GenerateQrCodeButton;
