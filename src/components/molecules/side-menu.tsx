'use client'

import { useState } from 'react';
import Dropdown from '../atoms/dropdown';
import { CONFIG, languageOption, ProjectId } from '@/config/config';
import { useLanguageContext } from '@/contexts/language-context';
import Link from 'next/link';

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
    <div className={`absolute z-[999] top-0 eft-0 ${isOpen ? 'left-0' : 'left-[-300px]'} flex items-center transition-all duration-200`}>
    <div className="max-w-[300px] bg-white p-4 h-screen max-h-screen overflow-y-scroll shadow-xl pb-16">
        <h1 className="font-bold text-blue-500 text-2xl">
          {CONFIG[projectId].title}
        </h1>
        <div className="text-sm pb-4 text-black">
          {CONFIG[projectId].locationInfo.map((item, idx) => {
            return (<div key={idx}>{item}</div>)
          })}
        </div>

        <h1 className=" font-bold text-gray-400">
          Information
        </h1>
        <div className="text-sm pb-4 text-black">
          {CONFIG[projectId].information}
        </div>
        <h1 className=" font-bold text-gray-400">
          Credits
        </h1>
        <div className="text-black text-sm pb-4">
          {
            CONFIG[projectId].credits.map((credit, idx) => {
              return <Link href={`https://instagram.com/${credit[2]}`} target="_blank" key={idx}><div className="text-blue-500">{credit[0]}</div> <div className="text-gray-400">{credit[1]}</div></Link>
            })
          }
        </div>

        <h1 className=" font-bold text-gray-400">
          Instructions
        </h1>
        <div className="text-sm pb-4 text-black">
          <div>Explore the 360 world with your mouse.</div>
          <div>You may proceed with the story by clicking on the arrow.</div>
          <div>On the bottom right, there&apos;s a map that informs the location of the protagonist in the real world. On the top right, there&apos;s information on the current latitude and longitude of the position. </div>
        </div>

        <h1 className=" font-bold text-gray-400">
          About
        </h1>
        <div className="text-black text-sm pb-4">
          <b>Streets</b> repurposes the familiar interface of Google Street View to explore narrative storytelling and subvert its original function of spatial navigation. This project transforms an internet tool for mapping and exploration into a medium for constructing layered, location-based narratives. By leveraging the intuitive arrows and panoramic visuals of Street View, the work invites users to navigate not physical spaces but the branching paths of fictional stories.

          The project includes countries that <a href="https://instagram.com/ekezia" target="_blank" className="text-blue-500">Kezia</a> has visited before.
        </div>

        

        <h1 className="font-bold text-gray-400">
          Language      
        </h1>
        <div className="text-sm text-black">
          Change the language for the subtitle of the story.
        </div>
        <Dropdown options={languageLabels} onSelect={handleSelect} />
      </div>

      <div className="bg-white rounded-r h-fit w-fit py-4 pl-2 cursor-pointer"
        onClick={() => {
            setIsOpen(!isOpen)          
          }}
        >
        <div className={`${isOpen ? 'rotate-180' : 'rotate-0'} transform origin-center flex justify-center items-center animation-all text-gray-400`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="20" height="20">
            <polygon points="5,7 15,15 5,23" fill="currentColor" />
          </svg>
        </div>

      </div>

    </div>
  )
}
export default SideMenu;