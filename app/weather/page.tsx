import Dashboard from '../dashboard';
export default async function Page({searchParams}:{searchParams:Promise<{date?:string}>}){
  const {date}=await searchParams;
  return <Dashboard initialScreen="weather" initialDate={date}/>;
}
