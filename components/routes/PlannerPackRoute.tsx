import React from 'react';
import { useParams } from 'react-router-dom';
import PlannerPackIndex from '../planner-pack/PlannerPackIndex';
import PlannerPackDetail from '../planner-pack/PlannerPackDetail';

const PlannerPackRoute: React.FC = () => {
  const { id } = useParams();
  return id ? React.createElement(PlannerPackDetail) : React.createElement(PlannerPackIndex);
};

export default PlannerPackRoute;
