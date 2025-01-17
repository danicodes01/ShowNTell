import React from 'react';
import { Carousel } from 'react-bootstrap/';
import axios from 'axios'; 
import image1 from './carouselPhotos/drive.jpg';
import image2 from './carouselPhotos/kingkong.jpg';
import image3 from './carouselPhotos/tesla.jpg';
import image4 from './carouselPhotos/shining.jpg';
import image5 from './carouselPhotos/castle.jpg';
import image7 from './carouselPhotos/bebop.jpg';
import './profile.css'; 
import styled from 'styled-components';

const Img = styled.div`
    display: flex;
    width: 100%;
    height: 50vh;
    padding: 1rem 1.5rem;
    margin-top: 30px; 
    img {
      object-fit: cover;
      margin-left: 180px;
      height: 100%;
      display: block;
    }
`;

const favorites = ({ sub }) => {
  // axios.get('/theme', {
  //   params: sub
  // }).then()
  const images = [image3, image2, image4, image5, image1, image7];
  return (
    <Carousel >
      { images.map((image, i) => (
        <Carousel.Item key = {i} >
          <Img>
            <img
              className="rounded mx-auto d-block w-100"
              src={image}
              alt="Responsive image"
            />
          </Img>
        </Carousel.Item>
      ))}
    </Carousel>

  );
};

export default favorites;
