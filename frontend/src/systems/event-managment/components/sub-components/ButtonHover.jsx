import styled from 'styled-components';
const ButtonHover = ({isSaving}) => {
  return (
    <StyledWrapper>
      <div className="scene h-7.5 overflow-hidden  flex justify-center items-center">
        <div className={`cube ${ isSaving ? "transform-[rotateX(-90deg)]" : ""}`}>
          <span className="side top bg-white/10 pl-3 pr-3 pt-1 pb-1">Saving...</span>
          <span className="side front bg-white/10 pl-3 pr-3 pt-1 pb-1">Saved</span>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .scene {
   justify-content: center;
   align-items: center;
  }

  .cube {
   font-family: 'Roboto', sans-serif;
   transition: all 0.85s cubic-bezier(.17,.67,.14,.93);
   transform-style: preserve-3d;
   transform-origin: 100% 50%;
   width: max-content;
   height: max-content;
   
  }

  

  .side {
   box-sizing: border-box;
   display: inline-block;
   height: max-content;
   width: max-content;
   text-align: center;
   
  }

  .top {
   
   color: #fff;
   transform: rotateX(90deg) translate3d(0, 0, 2em);

  }

  .front {
  
   color: #fff;

   transform: translate3d(0, 0, 2em);
  }`;

export default ButtonHover;
