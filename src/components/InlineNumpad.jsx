import React from 'react';

const NumpadButton = ({ value, onClick, children, className = '' }) => (
  <button
    type="button"
    onClick={() => onClick(value)}
    className={`h-12 w-12 flex items-center justify-center 
                bg-gray-200 hover:bg-gray-300 rounded-md font-semibold 
                text-gray-800 transition-colors text-lg ${className}`}
  >
    {children || value}
  </button>
);

const InlineNumpad = ({ onInput, onIncrement, onDecrement, onClear }) => {
  return (
    <div
      className="inline-grid grid-cols-[minmax(10rem,auto)_3.75rem] grid-rows-[3.25rem_3.25rem_3.25rem_3.25rem]
                 items-stretch gap-3 p-3 bg-white rounded-xl shadow-xl border border-gray-200
                 select-none touch-manipulation"
    >
      {/* Numbers: spans 4 rows */}
      <div className="col-start-1 row-span-4 grid grid-cols-3 grid-rows-4 gap-3">
        <NumpadButton value={7} onClick={onInput} />
        <NumpadButton value={8} onClick={onInput} />
        <NumpadButton value={9} onClick={onInput} />
        <NumpadButton value={4} onClick={onInput} />
        <NumpadButton value={5} onClick={onInput} />
        <NumpadButton value={6} onClick={onInput} />
        <NumpadButton value={1} onClick={onInput} />
        <NumpadButton value={2} onClick={onInput} />
        <NumpadButton value={3} onClick={onInput} />
        <NumpadButton value={0} onClick={onInput} className="col-span-2" />
        <NumpadButton value="C" onClick={onClear}
          className="bg-orange-400 hover:bg-orange-500 text-white">C</NumpadButton>
      </div>

      {/* Operators: spans 4 rows */}
      <div className="col-start-2 row-span-4 flex flex-col gap-3 w-[4rem]">
        <button
          type="button"
          onClick={onIncrement}
          className="flex-1 rounded-md text-white text-2xl font-bold
                     bg-green-500 hover:bg-green-600"
        >
          +
        </button>
        <button
          type="button"
          onClick={onDecrement}
          className="flex-1 rounded-md text-white text-2xl font-bold
                     bg-red-500 hover:bg-red-600"
        >
          -
        </button>
      </div>
    </div>
  );
};

export default InlineNumpad;