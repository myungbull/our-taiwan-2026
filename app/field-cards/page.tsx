import Dashboard from '../dashboard';
export default async function Page({searchParams}:{searchParams:Promise<{type?:string}>}){
  const {type}=await searchParams;
  const initialFieldType=type==='hotel'||type==='tour'?type:'airport';
  return <Dashboard initialScreen="field" initialFieldType={initialFieldType}/>;
}
