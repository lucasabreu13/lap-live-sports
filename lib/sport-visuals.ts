import type { SportId } from "@/lib/live-data";

type SportVisual = {
  image: string;
  alt: string;
};

export const SPORT_VISUALS: Record<SportId, SportVisual> = {
  futebol: { image: "/images/sports/futebol.jpg", alt: "Partida de futebol em um estadio" },
  "futebol-americano": { image: "/images/sports/futebol-americano.jpg", alt: "Partida de futebol americano" },
  tenis: { image: "/images/sports/tenis.jpg", alt: "Tenista em acao na quadra" },
  ciclismo: { image: "/images/sports/ciclismo.jpg", alt: "Pelotao em uma prova de ciclismo" },
  formula1: { image: "/images/sports/formula1.jpg", alt: "Carros de corrida em um circuito" },
  basquete: { image: "/images/sports/basquete.jpg", alt: "Jogo de basquete em quadra" },
  beisebol: { image: "/images/sports/beisebol.jpg", alt: "Jogo de beisebol no estadio" },
  softball: { image: "/images/sports/beisebol.jpg", alt: "Rebatida em um campo esportivo" },
  volei: { image: "/images/sports/volei.jpg", alt: "Partida de volei" },
  rugby: { image: "/images/sports/rugby.jpg", alt: "Jogadores em uma partida de rugby" },
  criquete: { image: "/images/sports/beisebol.jpg", alt: "Esporte de taco disputado em campo" },
  mma: { image: "/images/sports/mma.jpg", alt: "Lutadores em um combate" },
  golfe: { image: "/images/sports/golfe.jpg", alt: "Golfista executando uma tacada" },
  natacao: { image: "/images/sports/natacao.jpg", alt: "Nadadores em uma prova na piscina" },
  atletismo: { image: "/images/sports/atletismo.jpg", alt: "Atleta em uma prova de pista" },
  surfe: { image: "/images/sports/surfe.jpg", alt: "Surfista manobrando em uma onda" },
};

export function sportCoverImage(sportId: SportId) {
  return SPORT_VISUALS[sportId];
}
