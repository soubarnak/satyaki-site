public class Main {
    public static void main(String[] args) {
        if (isShieldOn() == false) {
            shield();
        }
        if (distanceAhead() == 0) {
            turnRight();
        }
        move();
        move();
        move();
        move();
        move();
        move();
    }
}
