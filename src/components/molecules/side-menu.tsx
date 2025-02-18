'use client'

import { useEffect, useState } from 'react';
import Dropdown from '../atoms/dropdown';
import { CONFIG, languageOption, ProjectId } from '@/config/config';
import { useLanguageContext } from '@/contexts/language-context';

const SideMenu: React.FC<{ projectId: ProjectId }> = ({ projectId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const { setCurrentLanguage, currentLanguage } = useLanguageContext()
  const handleSelect = (selectedLabel: string) => {
  const selectedOptionValue= Object.entries(languageOption).find(
    ([, option]) => option.label === selectedLabel
  )?.[0];

    setCurrentLanguage(selectedOptionValue)

  };

  const languageLabels = CONFIG[projectId].languageOptions.map((opt) => languageOption[opt].label);

  return(
    <div className={`absolute z-[999] top-0 eft-0 ${isOpen ? 'left-0' : 'left-[-240px]'} flex items-center transition-all duration-200`}>
      <div className="max-w-[240px] bg-white p-4 h-screen">
        <div className=" text-bold">
          Information
        </div>
        <div className="text-sm pb-4">
          {CONFIG[projectId].information}
        </div>
        <div className=" text-bold">
          Instruction
        </div>
        <div className="text-sm pb-4">
          Look around with your mouse
        </div>

        <div className=" text-bold">
          Language      
        </div>
        <Dropdown options={languageLabels} onSelect={handleSelect} />
      </div>

      <div className="bg-white rounded-r h-fit w-fit p-2 cursor-pointer"
        onClick={() => {
            setIsOpen(!isOpen)          
          }}
        >
        <div className={`${isOpen ? 'rotate-180' : 'rotate-0'} animation-all`}>
          ➡️
        </div>

      </div>

    </div>
  )
}
export default SideMenu;